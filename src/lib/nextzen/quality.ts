import { assessRisk } from "./risk.ts";
import type { Artifact, CommandProposal, Lang, OsTarget, RiskLevel, TaskResult } from "./types.ts";

/* ───────────────────────── Finding catalogs ───────────────────────── */

export type Severity = "error" | "warn" | "info";

export type LintCode =
  | "unbalanced_quotes"
  | "unbalanced_brackets"
  | "os_mismatch"
  | "unquoted_variable"
  | "root_target"
  | "placeholder"
  | "no_dry_run"
  | "insecure_flag"
  | "pipe_to_shell"
  | "invalid_json"
  | "missing_strict_mode"
  | "yaml_tabs"
  | "unpinned_action";

export type GapCode =
  | "no_validation"
  | "no_rollback"
  | "command_no_rollback"
  | "command_no_impact"
  | "no_readonly_first"
  | "lint_errors"
  | "empty_plan";

export const LINT_SEVERITY: Record<LintCode, Severity> = {
  unbalanced_quotes: "error",
  unbalanced_brackets: "error",
  os_mismatch: "warn",
  unquoted_variable: "warn",
  root_target: "error",
  placeholder: "warn",
  no_dry_run: "info",
  insecure_flag: "warn",
  pipe_to_shell: "error",
  invalid_json: "error",
  missing_strict_mode: "info",
  yaml_tabs: "error",
  unpinned_action: "warn",
};

const LINT_TEXT: Record<LintCode, Record<Lang, string>> = {
  unbalanced_quotes: {
    tr: "Tırnaklar eşleşmiyor. Komut çalıştırılmadan önce sözdizimi hatası verir.",
    en: "Quotes do not balance. The command will fail with a syntax error.",
  },
  unbalanced_brackets: {
    tr: "Parantez veya süslü parantezler eşleşmiyor.",
    en: "Parentheses or braces do not balance.",
  },
  os_mismatch: {
    tr: "Komut, hedef işletim sistemiyle uyuşmuyor görünüyor.",
    en: "The command does not look compatible with the target operating system.",
  },
  unquoted_variable: {
    tr: 'Değişken tırnaksız kullanılıyor. Boşluk içeren veya boş bir değer yanlış yolu etkileyebilir; "$DEGISKEN" yazın.',
    en: 'A variable is used unquoted. An empty or spaced value can hit the wrong path; quote it as "$VAR".',
  },
  root_target: {
    tr: "Hedef kök dizin, ev dizini veya joker karakter. Çalıştırmayın.",
    en: "The target is the root, the home directory, or a bare wildcard. Do not run this.",
  },
  placeholder: {
    tr: "Doldurulmamış bir yer tutucu var. Çalıştırmadan önce gerçek değerle değiştirin.",
    en: "An unfilled placeholder remains. Replace it with a real value before running.",
  },
  no_dry_run: {
    tr: "Bu aracın deneme modu var (örn. --dry-run, -WhatIf, plan). Önce onu çalıştırın.",
    en: "This tool has a dry-run mode (e.g. --dry-run, -WhatIf, plan). Run that first.",
  },
  insecure_flag: {
    tr: "Güvenlik denetimini kapatan bir seçenek var (sertifika, izin veya anahtar doğrulaması).",
    en: "An option turns off a safety check (certificate, permission, or key verification).",
  },
  pipe_to_shell: {
    tr: "İndirilen içerik doğrudan yorumlayıcıya aktarılıyor. Önce dosyaya indirip okuyun.",
    en: "Downloaded content is piped straight into an interpreter. Save it, read it, then run it.",
  },
  invalid_json: {
    tr: "JSON geçerli değil; ayrıştırma hatası veriyor.",
    en: "The JSON is not valid and fails to parse.",
  },
  missing_strict_mode: {
    tr: "Betik hata durumunda durmuyor (set -euo pipefail veya $ErrorActionPreference yok).",
    en: "The script does not stop on errors (no set -euo pipefail or $ErrorActionPreference).",
  },
  yaml_tabs: {
    tr: "YAML girintisinde sekme karakteri var. YAML yalnızca boşluk kabul eder.",
    en: "The YAML is indented with tabs. YAML only allows spaces.",
  },
  unpinned_action: {
    tr: "GitHub Action sürüme veya commit'e sabitlenmemiş (@main, @master veya @latest).",
    en: "A GitHub Action is not pinned to a version or commit (@main, @master, or @latest).",
  },
};

const GAP_TEXT: Record<GapCode, Record<Lang, string>> = {
  no_validation: {
    tr: "Doğrulama adımı yok. Sonucun doğru çalıştığını nasıl anlayacağınız belli değil.",
    en: "There are no validation steps. It is unclear how to confirm the result works.",
  },
  no_rollback: {
    tr: "Geri alma planı yok, oysa işlem riskli.",
    en: "There is no rollback plan for a risky change.",
  },
  command_no_rollback: {
    tr: "Bazı orta veya yüksek riskli komutların geri alma yöntemi yok.",
    en: "Some medium or high risk commands have no rollback method.",
  },
  command_no_impact: {
    tr: "Bazı yüksek riskli komutların etkisi açıklanmamış.",
    en: "Some high risk commands do not explain their impact.",
  },
  no_readonly_first: {
    tr: "Değiştiren komutlardan önce salt okunur bir kontrol komutu yok.",
    en: "No read-only check comes before the commands that change things.",
  },
  lint_errors: {
    tr: "Komut veya dosya denetimi hata buldu. Çalıştırmadan önce düzeltin.",
    en: "The command or file check found errors. Fix them before running.",
  },
  empty_plan: {
    tr: "Plan veya varsayım bölümü boş geldi.",
    en: "The plan or assumptions section came back empty.",
  },
};

export function lintText(code: string, lang: Lang): string {
  return LINT_TEXT[code as LintCode]?.[lang] ?? code;
}
export function lintSeverity(code: string): Severity {
  return LINT_SEVERITY[code as LintCode] ?? "info";
}
export function gapText(code: string, lang: Lang): string {
  return GAP_TEXT[code as GapCode]?.[lang] ?? code;
}

/* ───────────────────────── Shell scanning helpers ───────────────────────── */

interface Scanned {
  /** The text with every quoted string collapsed to Q. */
  unquoted: string;
  openQuote: boolean;
}

/** Walks the text once, tracking quotes and comments. POSIX escapes with \, PowerShell with `. */
function scanQuotes(text: string, powershell: boolean): Scanned {
  let out = "";
  let quote: "'" | '"' | null = null;
  const escape = powershell ? "`" : "\\";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? "";
    if (quote === null) {
      if (ch === "#" && (i === 0 || /\s/.test(text[i - 1] ?? ""))) {
        while (i < text.length && text[i] !== "\n") i += 1;
        out += "\n";
        continue;
      }
      if (ch === escape) {
        out += ch + (text[i + 1] ?? "");
        i += 1;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        out += "Q";
        continue;
      }
      out += ch;
    } else {
      if (ch === escape && quote === '"') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        // PowerShell escapes a quote by doubling it inside the string.
        if (powershell && text[i + 1] === quote) {
          i += 1;
          continue;
        }
        quote = null;
      }
    }
  }
  return { unquoted: out, openQuote: quote !== null };
}

function bracketsBalanced(unquoted: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  const stack: string[] = [];
  for (const ch of unquoted) {
    if (ch === "(" || ch === "{" || ch === "[") stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

/* ───────────────────────── OS detection ───────────────────────── */

type Os = "linux" | "macos" | "windows" | "any";

function osOf(value: string): Os {
  const v = value.toLowerCase();
  if (/win/.test(v) && !/darwin/.test(v)) return "windows";
  if (/mac|darwin|osx/.test(v)) return "macos";
  if (/lin|ubuntu|debian|fedora|centos|rhel|alpine|arch|posix|bash|zsh|sh\b/.test(v))
    return "linux";
  return "any";
}

const POWERSHELL =
  /\b(?:get|set|new|remove|start|stop|restart|invoke|test|select|where|foreach|out|add|clear|import|export|write|read|enable|disable|install|uninstall|copy|move|rename)-[a-z]{3,}\b|\$env:|\$psversiontable|-whatif\b|-erroraction\b/i;
const WINDOWS_CMD =
  /(?:^|\s)(?:ipconfig|tasklist|taskkill|wmic|findstr|sc\s+(?:query|stop|start)|reg\s+(?:query|add)|schtasks|netstat\s+-ano|dir\s+\/|[a-z]:\\)/i;
const LINUX_ONLY =
  /(?:^|[\s;&|])(?:apt(?:-get)?|dpkg|yum|dnf|zypper|pacman|apk|systemctl|journalctl|service|ufw|iptables|useradd|usermod|chown|chmod|crontab|free|lsblk|ss)\b|\/etc\/|\/var\/|\/proc\//i;
const MAC_ONLY =
  /(?:^|[\s;&|])(?:brew|launchctl|diskutil|defaults\s+(?:read|write)|pbcopy|pbpaste|sw_vers|networksetup|mdfind|dscl|pfctl)\b/i;
const LINUX_NOT_MAC =
  /(?:^|[\s;&|])(?:apt(?:-get)?|dpkg|yum|dnf|zypper|pacman|apk|systemctl|journalctl|ufw|iptables|free|lsblk|useradd)\b/i;

function osMismatch(command: string, declared: Os, target: OsTarget): boolean {
  const effective: Os = declared !== "any" ? declared : (target as Os);
  if (target !== "any" && declared !== "any" && declared !== target) return true;
  if (effective === "any") return false;
  const ps = POWERSHELL.test(command);
  if (effective === "windows") {
    return !ps && (LINUX_ONLY.test(command) || MAC_ONLY.test(command));
  }
  if (ps || WINDOWS_CMD.test(command)) return true;
  if (effective === "linux") return MAC_ONLY.test(command);
  return LINUX_NOT_MAC.test(command);
}

/* ───────────────────────── Command and artifact lint ───────────────────────── */

const DRY_RUN_CHECKS: { tool: RegExp; safe: RegExp }[] = [
  { tool: /\brsync\b/i, safe: /\s-[a-z]*n[a-z]*\b|--dry-run/i },
  {
    tool: /\bapt(?:-get)?\s+(?:install|remove|purge|upgrade|dist-upgrade)\b/i,
    safe: /\s-s\b|--simulate|--dry-run|--just-print/i,
  },
  { tool: /\bterraform\s+apply\b/i, safe: /-plan|\bplan\b/i },
  { tool: /\bkubectl\s+(?:apply|delete|create|replace|patch)\b/i, safe: /--dry-run|\sdiff\b/i },
  { tool: /\bansible-playbook\b/i, safe: /--check|\s-C\b|--diff/i },
  { tool: /\bgit\s+clean\b/i, safe: /\s-[a-z]*n[a-z]*\b|--dry-run/i },
  {
    tool: /\b(?:remove|set|stop|restart|new|move|rename|clear|disable|uninstall)-[a-z]+\b/i,
    safe: /-whatif\b|-confirm\b/i,
  },
  { tool: /\bhelm\s+(?:install|upgrade)\b/i, safe: /--dry-run/i },
  {
    tool: /\bdnf\s+(?:install|remove)\b|\byum\s+(?:install|remove)\b/i,
    safe: /--assumeno|--setopt=tsflags=test/i,
  },
];

const INSECURE =
  /\scurl\b[^\n]*\s(?:-k|--insecure)\b|--no-check-certificate|verify\s*=\s*false|stricthostkeychecking\s*=\s*no|-skipcertificatecheck|node_tls_reject_unauthorized\s*=\s*0|--allow-unauthenticated|--force-yes|\bchmod\s+(?:-r\s+)?0?777\b|set-executionpolicy\s+(?:bypass|unrestricted)/i;

const PLACEHOLDER =
  /<[a-z][a-z0-9_ -]{1,30}>|\byour[_-][a-z_-]{2,}|\bchangeme\b|\bxxx+\b|\bexample\.(?:com|org|net)\b|\btodo\b|\bfixme\b/i;

const ROOT_TARGET_POSIX =
  /\b(?:rm|chmod|chown|chgrp)\b[^\n|;&]*?\s(?:\/\*?|~\/?\*?|\$\{?home\}?\/?\*?|\*)(?=\s|$|;|&|\|)/i;
const ROOT_TARGET_WINDOWS = /\bremove-item\b[^\n]*\s(?:[a-z]:\\?|\\)(?=\s|$)/i;

export interface LintOptions {
  declaredOs: string;
  targetOs: OsTarget;
  risk: RiskLevel;
  /** Multi-line script mode: skip checks that need a single statement. */
  script?: boolean;
}

export function lintCommand(command: string, options: LintOptions): string[] {
  const out: LintCode[] = [];
  const text = command.trim();
  const ps = POWERSHELL.test(text) && !/^\s*(?:sudo\s|apt|bash|sh)\b/i.test(text);
  const hasHeredoc = /<<-?\s*['"]?\w+/.test(text);
  const hasCase = /\bcase\b[\s\S]*\besac\b/.test(text);
  const scanned = scanQuotes(text, ps);

  if (!hasHeredoc && scanned.openQuote) out.push("unbalanced_quotes");
  if (!hasHeredoc && !hasCase && !scanned.openQuote && !bracketsBalanced(scanned.unquoted)) {
    out.push("unbalanced_brackets");
  }
  if (osMismatch(text, osOf(options.declaredOs), options.targetOs)) out.push("os_mismatch");
  if (
    !ps &&
    /\b(?:rm|mv|cp|chmod|chown|chgrp|dd|rsync|tar)\b[^\n;|&]*\$\{?[a-z_]/i.test(scanned.unquoted)
  ) {
    out.push("unquoted_variable");
  }
  if (
    ROOT_TARGET_POSIX.test(text) ||
    ROOT_TARGET_WINDOWS.test(text) ||
    /--no-preserve-root/.test(text)
  ) {
    out.push("root_target");
  }
  if (PLACEHOLDER.test(text)) out.push("placeholder");
  if (INSECURE.test(` ${text}`)) out.push("insecure_flag");
  if (assessRisk(text, "code").reasons.includes("remote_script")) out.push("pipe_to_shell");
  if (options.risk !== "low") {
    const missing = DRY_RUN_CHECKS.some((c) => c.tool.test(text) && !c.safe.test(text));
    if (missing) out.push("no_dry_run");
  }
  return [...new Set(out)];
}

const SHELL_LANGS = new Set(["bash", "sh", "shell", "zsh", "console", "shellscript"]);
const POWERSHELL_LANGS = new Set(["powershell", "ps1", "pwsh"]);

export function lintArtifact(
  artifact: Pick<Artifact, "language" | "filename" | "content">,
  targetOs: OsTarget,
): string[] {
  const out: LintCode[] = [];
  const lang = artifact.language.toLowerCase();
  const name = artifact.filename.toLowerCase();
  const body = artifact.content;

  if (lang === "json" || (name.endsWith(".json") && lang !== "jsonc")) {
    try {
      JSON.parse(body);
    } catch {
      out.push("invalid_json");
    }
  }
  if (SHELL_LANGS.has(lang) || POWERSHELL_LANGS.has(lang) || /\.(?:sh|bash|ps1)$/.test(name)) {
    const isPs = POWERSHELL_LANGS.has(lang) || name.endsWith(".ps1");
    const declared = isPs ? "windows" : "any";
    const findings = lintCommand(body, {
      declaredOs: declared,
      targetOs: isPs && targetOs === "linux" ? "linux" : targetOs,
      risk: assessRisk(body, "code").level,
      script: true,
    });
    for (const code of findings) out.push(code as LintCode);
    const lines = body.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    if (lines.length > 5) {
      const strict = isPs
        ? /\$erroractionpreference\s*=\s*['"]?stop/i.test(body)
        : /\bset\s+-[a-z]*e[a-z]*\b|set\s+-o\s+errexit/i.test(body);
      if (!strict) out.push("missing_strict_mode");
    }
  }
  if (lang === "yaml" || lang === "yml" || /\.ya?ml$/.test(name)) {
    if (/^\t/m.test(body)) out.push("yaml_tabs");
    if (/^\s*-?\s*uses:\s*[\w./-]+@(?:main|master|latest)\s*$/im.test(body))
      out.push("unpinned_action");
  }
  return [...new Set(out)];
}

/* ───────────────────────── Completeness ───────────────────────── */

export function computeGaps(result: TaskResult): GapCode[] {
  if (result.refused) return [];
  const gaps: GapCode[] = [];
  const hasWork = result.commands.length > 0 || result.generatedArtifacts.length > 0;
  if (hasWork && result.validationSteps.length === 0) gaps.push("no_validation");

  const risky = result.commands.filter((c) => c.riskLevel !== "low");
  if (result.riskLevel !== "low" && risky.length > 0 && result.rollbackPlan.length === 0) {
    gaps.push("no_rollback");
  }
  if (risky.some((c) => !c.rollback.trim())) gaps.push("command_no_rollback");
  if (result.commands.some((c) => c.riskLevel === "high" && !c.impact.trim())) {
    gaps.push("command_no_impact");
  }
  const firstMutating = result.commands.findIndex((c) => c.riskLevel !== "low");
  if (firstMutating >= 0) {
    const readOnlyBefore = result.commands
      .slice(0, firstMutating)
      .some((c) => c.riskLevel === "low");
    if (!readOnlyBefore) gaps.push("no_readonly_first");
  }
  const lintErrors = [
    ...result.commands.flatMap((c) => c.lint ?? []),
    ...result.generatedArtifacts.flatMap((a) => a.lint ?? []),
  ].some((code) => lintSeverity(code) === "error");
  if (lintErrors) gaps.push("lint_errors");
  if (result.plan.length === 0) gaps.push("empty_plan");
  return gaps;
}

/**
 * Runs the deterministic checks over a finished result: per-command and per-file lint,
 * then a completeness review. Safe to call twice; it recomputes from the content.
 */
export function applyQuality(result: TaskResult, targetOs: OsTarget): TaskResult {
  const commands: CommandProposal[] = result.commands.map((command) => ({
    ...command,
    lint: lintCommand(command.command, {
      declaredOs: command.os,
      targetOs,
      risk: command.riskLevel,
    }),
  }));
  const generatedArtifacts: Artifact[] = result.generatedArtifacts.map((artifact) => ({
    ...artifact,
    lint: lintArtifact(artifact, targetOs),
  }));
  const next: TaskResult = { ...result, commands, generatedArtifacts };
  return { ...next, gaps: computeGaps(next) };
}
