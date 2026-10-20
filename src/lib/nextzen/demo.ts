import { detectCategory } from "./category.ts";
import { assessInput, assessRisk, maxRisk, reasonText } from "./risk.ts";
import type {
  Artifact,
  Category,
  CommandProposal,
  Focus,
  Lang,
  TaskInput,
  TaskResult,
} from "./types.ts";

function L(lang: Lang, tr: string, en: string): string {
  return lang === "en" ? en : tr;
}

function line(lang: Lang, tr: string, en: string): string {
  return L(lang, tr, en);
}

export function buildDemoResult(input: TaskInput): TaskResult {
  const blob = `${input.title}\n${input.description}\n${input.projectContext}`;
  const risk = assessInput(input);
  const category = detectCategory(blob, input.category);
  const lang = input.languagePref;
  if (risk.malware) return refusal(input, category, lang);
  const reasons = risk.reasons.map((reason) => reasonText(reason, lang));
  const riskyLines = blob
    .split("\n")
    .map((item) => item.trim())
    .filter(
      (item) => item.length > 0 && item.length < 400 && assessRisk(item, "code").level === "high",
    )
    .slice(0, 2);
  const commands = commandsFor(input, category, riskyLines);
  const level = commands.reduce((acc, command) => maxRisk(acc, command.riskLevel), risk.level);
  const approval = level === "high";
  const artifacts = artifactsFor(input, category);
  return {
    summary: line(
      lang,
      `Demo Modu özeti: “${input.title}” için ${categoryLabel(category, lang)} planı üretildi. Bu metin gerçek bir model yanıtı değildir.`,
      `Demo Mode summary: a ${categoryLabel(category, lang)} plan was prepared for “${input.title}”. This text is not a real model response.`,
    ),
    assumptions: [
      line(
        lang,
        input.os === "any"
          ? "Hedef işletim sistemi belirtilmedi; örnekler POSIX kabuğuna göredir."
          : `Hedef sistem: ${input.os}.`,
        input.os === "any"
          ? "No operating system was selected; samples use a POSIX shell."
          : `Target system: ${input.os}.`,
      ),
      line(
        lang,
        input.language
          ? `Tercih edilen teknoloji: ${input.language}.`
          : "Teknoloji seçilmedi; örnek dil kategoriye göredir.",
        input.language
          ? `Preferred technology: ${input.language}.`
          : "No technology was selected; the sample follows the category.",
      ),
      line(
        lang,
        "Nextzen bu oturumda hiçbir komutu çalıştırmadı.",
        "Nextzen did not execute any command in this session.",
      ),
    ],
    plan: planFor(input, category),
    riskLevel: level,
    risks: reasons.length
      ? reasons
      : [
          line(
            lang,
            "Belirgin yıkıcı ifade yok. Yine de öneriyi uygulamadan önce okuyun.",
            "No obvious destructive phrase. Still read the proposal before using it.",
          ),
        ],
    approvalRequired: approval,
    affectedResources: affected(input, category, lang),
    consequences: [
      line(
        lang,
        approval
          ? "Yüksek riskli öneri uygulanırsa veri veya erişim kalıcı değişebilir."
          : "Öneri uygulanırsa yalnızca tarif edilen yerel dosya veya çıktı etkilenir.",
        approval
          ? "Applying the high-risk proposal could permanently change data or access."
          : "Applying the proposal should affect only the described local file or output.",
      ),
    ],
    reversible: approval ? "no" : level === "medium" ? "partial" : "yes",
    generatedArtifacts: artifacts,
    commands: commands.map((command) => ({
      ...command,
      approvalRequired: command.approvalRequired || (approval && command.riskLevel === "high"),
    })),
    installationSteps: installFor(input, category),
    validationSteps: [
      line(
        lang,
        "Çıktıyı çalıştırmadan diff veya salt okunur komutla kontrol edin.",
        "Check the output with a diff or a read-only command before running it.",
      ),
      line(
        lang,
        "Beklenen dosya adlarının kendi projenize uyduğunu doğrulayın.",
        "Confirm the expected file names match your project.",
      ),
      line(lang, "Gizli değer içermediğinden emin olun.", "Make sure it contains no secrets."),
    ],
    rollbackPlan: [
      line(
        lang,
        approval
          ? "Yıkıcı adımın yedeği yoksa uygulamayın. Önce kopya alın."
          : "Değişiklik yapıldıysa sürüm kontrolündeki önceki haline dönün.",
        approval
          ? "Do not apply a destructive step without a backup. Copy the data first."
          : "If a change was made, return to the previous version control state.",
      ),
      line(
        lang,
        "Nextzen geri alma komutunu kendisi çalıştırmaz.",
        "Nextzen does not run the rollback command for you.",
      ),
    ],
    warnings: [
      line(
        lang,
        "DEMO MODU — bu yanıt deterministik bir örnektir, Grok çıktısı değildir.",
        "DEMO MODE — this is a deterministic sample, not a Grok response.",
      ),
      ...(input.safePreview
        ? [
            line(
              lang,
              "Güvenli önizleme açık. Komutlar yalnızca okunmak üzere gösterilir.",
              "Safe preview is on. Commands are shown for reading only.",
            ),
          ]
        : []),
      ...reasons,
    ],
    finalResponse: finalText(input, category),
    requirements: requirementsFor(input, category),
    envVars: envFor(category, lang),
    disableSteps: [
      line(
        lang,
        "Zamanlanmış iş eklediyseniz ilgili cron veya workflow kaydını kaldırın.",
        "If you added a schedule, remove that cron entry or workflow.",
      ),
      line(
        lang,
        "Kurulan örnek dosyayı kullanmayacaksanız silin.",
        "Delete the sample file if you will not keep it.",
      ),
    ],
    refused: false,
  };
}

function refusal(input: TaskInput, category: Category, lang: Lang): TaskResult {
  return {
    summary: line(
      lang,
      "Bu istek zararlı yazılım veya yetkisiz erişim içerdiği için reddedildi.",
      "This request was refused because it asks for malware or unauthorized access.",
    ),
    assumptions: [
      line(
        lang,
        "Nextzen saldırı aracı veya istismar adımı üretmez.",
        "Nextzen does not produce attack tools or exploit steps.",
      ),
    ],
    plan: [
      line(
        lang,
        "İsteği savunma, inceleme veya belge kapsamında yeniden yazın.",
        "Rewrite the request as defense, review, or documentation.",
      ),
    ],
    riskLevel: "high",
    risks: [reasonText("malware", lang)],
    approvalRequired: false,
    affectedResources: [input.title],
    consequences: [
      line(lang, "Reddedilen içerik üretilmedi.", "The refused content was not generated."),
    ],
    reversible: "yes",
    generatedArtifacts: [],
    commands: [],
    installationSteps: [],
    validationSteps: [
      line(
        lang,
        "Kayıtta istismar kodu bulunmadığını kontrol edin.",
        "Check that the record contains no exploit code.",
      ),
    ],
    rollbackPlan: [line(lang, "Uygulanacak bir değişiklik yok.", "There is no change to undo.")],
    warnings: [
      line(
        lang,
        "Güvenlik politikası bu isteği durdurdu.",
        "The safety policy stopped this request.",
      ),
    ],
    finalResponse: line(
      lang,
      `“${input.title}” için saldırı içeriği üretilmedi. Denetim, yama veya kayıt incelemesi istiyorsanız görevi o çerçevede yeniden gönderin.`,
      `No attack content was produced for “${input.title}”. Resubmit if you want an audit, a patch, or log review.`,
    ),
    requirements: [],
    envVars: [],
    disableSteps: [],
    refused: true,
  };
}

function affected(input: TaskInput, category: Category, lang: Lang): string[] {
  const tech = input.language || categoryLabel(category, lang);
  return [
    line(lang, `Görev: ${input.title}`, `Task: ${input.title}`),
    line(lang, `Alan: ${tech}`, `Area: ${tech}`),
  ];
}

function categoryLabel(category: Category, lang: Lang): string {
  if (category === "software") return lang === "en" ? "software" : "yazılım";
  if (category === "automation") return lang === "en" ? "automation" : "otomasyon";
  return lang === "en" ? "systems" : "sistem";
}

function planFor(input: TaskInput, category: Category): string[] {
  const lang = input.languagePref;
  const focus = input.focus;
  if (category === "software") {
    return [
      line(
        lang,
        `Odak: ${focusLabel(focus, lang)}. İstenen işi küçük bir değişikliğe böl.`,
        `Focus: ${focusLabel(focus, lang)}. Split the work into a small change.`,
      ),
      line(
        lang,
        "Önce mevcut davranışı ve kabul ölçütünü yaz.",
        "Write the current behavior and the acceptance check first.",
      ),
      line(
        lang,
        "Örneği kendi dosya ağacınıza uyarlayın; kör kopyalamayın.",
        "Adapt the sample to your tree; do not paste it blindly.",
      ),
      line(
        lang,
        "Test veya salt okuma ile doğrulayın.",
        "Validate with a test or a read-only check.",
      ),
    ];
  }
  if (category === "automation") {
    return [
      line(
        lang,
        "Tetikleyiciyi, girdiyi ve başarı koşulunu ayırın.",
        "Separate the trigger, the input, and the success condition.",
      ),
      line(
        lang,
        "Gizli değerleri betiğin içine yazmayın; ortam değişkeni kullanın.",
        "Do not hard-code secrets; use environment variables.",
      ),
      line(lang, "Önce kuru çalıştırma veya echo ile deneyin.", "Try a dry run or echo first."),
      line(
        lang,
        "Kapatma adımını aynı kayıtta tutun.",
        "Keep the disable step in the same record.",
      ),
    ];
  }
  return [
    line(lang, "Önce salt okunur tanı koyun.", "Start with a read-only diagnosis."),
    line(
      lang,
      "Etki, yetki ve geri almayı komutun yanında okuyun.",
      "Read impact, privilege, and rollback beside the command.",
    ),
    line(
      lang,
      "Yüksek riskli satırı ancak yedekten sonra ele alın.",
      "Touch a high-risk line only after a backup.",
    ),
    line(lang, "Sonucu bu kayıtla karşılaştırın.", "Compare the outcome with this record."),
  ];
}

function commandsFor(input: TaskInput, category: Category, risky: string[]): CommandProposal[] {
  const lang = input.languagePref;
  const os = input.os === "any" ? "linux" : input.os;
  const safe = baseCommand(input, category, os);
  const list: CommandProposal[] = [safe];
  for (const snippet of risky) {
    list.push({
      purpose: line(
        lang,
        "İstekte geçen yüksek riskli satır. Çalıştırılmadı.",
        "High-risk line from the request. It was not executed.",
      ),
      os,
      command: snippet,
      privilege: "admin",
      riskLevel: "high",
      impact: line(
        lang,
        "Veri, erişim veya hizmet kalıcı etkilenebilir.",
        "Data, access, or a service may be permanently affected.",
      ),
      rollback: line(
        lang,
        "Bu satırın genel bir geri alma yolu yoktur. Yedek şart.",
        "This line has no general undo. A backup is required.",
      ),
      approvalRequired: true,
    });
  }
  return list;
}

function baseCommand(input: TaskInput, category: Category, os: string): CommandProposal {
  const lang = input.languagePref;
  if (category === "sysadmin") {
    const command =
      os === "windows"
        ? "Get-Counter '\\Processor(_Total)\\% Processor Time'; Get-PSDrive -PSProvider FileSystem"
        : os === "macos"
          ? "sysctl -n hw.memsize; df -h; uptime"
          : "uptime; df -h; free -h || vm_stat";
    return {
      purpose: line(lang, "Salt okunur kaynak özeti", "Read-only resource summary"),
      os,
      command,
      privilege: "user",
      riskLevel: "low",
      impact: line(lang, "Sistemde değişiklik yapmaz.", "Does not change the system."),
      rollback: line(lang, "Gerekmez.", "Not required."),
      approvalRequired: false,
    };
  }
  if (category === "automation") {
    const runtime = runtimeOf(input.focus);
    const command =
      runtime === "powershell"
        ? "Write-Output 'Nextzen demo — no change'"
        : runtime === "node"
          ? "node -e \"console.log('Nextzen demo — no change')\""
          : runtime === "python"
            ? "python -c \"print('Nextzen demo — no change')\""
            : "printf '%s\\n' 'Nextzen demo — no change'";
    return {
      purpose: line(lang, "Yan etki bırakmayan duman testi", "Smoke check with no side effect"),
      os,
      command,
      privilege: "user",
      riskLevel: "low",
      impact: line(lang, "Yalnızca standart çıktı üretir.", "Prints to standard output only."),
      rollback: line(lang, "Gerekmez.", "Not required."),
      approvalRequired: false,
    };
  }
  return {
    purpose: line(
      lang,
      "Örnek dosyayı yazmadan önce görüntüleme",
      "Preview before writing a sample file",
    ),
    os,
    command: "git status --short",
    privilege: "none",
    riskLevel: "low",
    impact: line(lang, "Çalışma ağacını yalnızca okur.", "Only reads the working tree."),
    rollback: line(lang, "Gerekmez.", "Not required."),
    approvalRequired: false,
  };
}

function artifactsFor(input: TaskInput, category: Category): Artifact[] {
  const lang = input.languagePref;
  const tech = input.language || (category === "automation" ? runtimeOf(input.focus) : "ts");
  if (category === "automation") return [automationArtifact(input, lang)];
  if (category === "sysadmin") return [sysadminArtifact(input, lang)];
  return [softwareArtifact(input, lang, tech)];
}

function softwareArtifact(input: TaskInput, lang: Lang, tech: string): Artifact {
  const content =
    lang === "en"
      ? `export function reviewScope(title: string): { title: string; checks: string[] } {\n  return {\n    title,\n    checks: ["state the current behavior", "name the acceptance check", "avoid unrelated refactors"],\n  };\n}\n`
      : `export function kapsamOzeti(baslik: string): { baslik: string; kontroller: string[] } {\n  return {\n    baslik,\n    kontroller: ["mevcut davranışı yaz", "kabul ölçütünü adlandır", "ilgisiz yeniden yazımdan kaçın"],\n  };\n}\n`;
  return {
    language: tech.toLowerCase().includes("py") ? "python" : "ts",
    filename: lang === "en" ? "review-scope.ts" : "kapsam-ozeti.ts",
    content,
    purpose: L(
      lang,
      `${input.focus} odağı için örnek iskelet. Demo şablonudur.`,
      `Sample skeleton for the ${input.focus} focus. It is a demo template.`,
    ),
  };
}

function automationArtifact(input: TaskInput, lang: Lang): Artifact {
  const runtime = runtimeOf(input.focus);
  if (runtime === "gha") {
    return {
      language: "yaml",
      filename: ".github/workflows/nextzen-demo.yml",
      content:
        'name: nextzen-demo\non:\n  workflow_dispatch:\njobs:\n  inspect:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Show context without secrets\n        run: echo "demo ${GITHUB_REPOSITORY}"\n',
      purpose: L(
        lang,
        "El ile tetiklenen örnek iş akışı. Gizli bağlam yazdırmaz.",
        "Manually triggered sample workflow. It does not print secrets.",
      ),
    };
  }
  if (runtime === "python") {
    return {
      language: "python",
      filename: "nextzen_demo.py",
      content:
        'import os\n\ndef main() -> None:\n    target = os.environ.get("NEXTZEN_TARGET", "local")\n    print(f"demo target={target}")\n\nif __name__ == "__main__":\n    main()\n',
      purpose: L(
        lang,
        "Ortam değişkeni okuyan, dosya değiştirmeyen örnek.",
        "Sample that reads an environment variable and changes no files.",
      ),
    };
  }
  if (runtime === "node") {
    return {
      language: "javascript",
      filename: "nextzen-demo.mjs",
      content:
        'const target = process.env.NEXTZEN_TARGET ?? "local";\nconsole.log(`demo target=${target}`);\n',
      purpose: L(lang, "Node örneği. Ağ çağrısı yapmaz.", "Node sample. It makes no network call."),
    };
  }
  if (runtime === "powershell") {
    return {
      language: "powershell",
      filename: "nextzen-demo.ps1",
      content:
        "$target = if ($env:NEXTZEN_TARGET) { $env:NEXTZEN_TARGET } else { 'local' }\nWrite-Output \"demo target=$target\"\n",
      purpose: L(
        lang,
        "PowerShell örneği. Sistem ayarını değiştirmez.",
        "PowerShell sample. It does not change system settings.",
      ),
    };
  }
  return {
    language: "bash",
    filename: "nextzen-demo.sh",
    content:
      '#!/usr/bin/env bash\nset -euo pipefail\ntarget="${NEXTZEN_TARGET:-local}"\nprintf \'demo target=%s\\n\' "$target"\n',
    purpose: L(
      lang,
      "Bash örneği. set -euo pipefail kullanır ve dosya yazmaz.",
      "Bash sample. It uses set -euo pipefail and writes no files.",
    ),
  };
}

function sysadminArtifact(input: TaskInput, lang: Lang): Artifact {
  return {
    language: "markdown",
    filename: "tanilama-notu.md",
    content: L(
      lang,
      `# Tanılama notu\n\nGörev: ${input.title}\n\n1. Kaynak özetini salt okunur alın.\n2. Eşik aşıldıysa hangi birimin dolduğunu ayırın.\n3. Silme veya yeniden başlatma varsa yedek ve onay olmadan ilerlemeyin.\n`,
      `# Diagnostic note\n\nTask: ${input.title}\n\n1. Take a read-only resource summary.\n2. If a threshold is exceeded, isolate which unit is full.\n3. Do not delete or restart without a backup and approval.\n`,
    ),
    purpose: L(
      lang,
      "Operatör notu. Komutların yerine geçmez.",
      "Operator note. It does not replace the commands.",
    ),
  };
}

function installFor(input: TaskInput, category: Category): string[] {
  const lang = input.languagePref;
  if (category === "automation") {
    return [
      L(
        lang,
        "Örnek dosyayı depoya ancak içeriği okuduktan sonra ekleyin.",
        "Add the sample file to the repo only after reading it.",
      ),
      L(
        lang,
        "NEXTZEN_TARGET değerini gizli olmayan bir yerde tanımlayın.",
        "Set NEXTZEN_TARGET somewhere that is not secret.",
      ),
    ];
  }
  if (category === "sysadmin") {
    return [
      L(
        lang,
        "Ek paket kurmadan önce salt okunur komutları kullanın.",
        "Use the read-only commands before installing anything.",
      ),
    ];
  }
  return [
    L(
      lang,
      "Örnek fonksiyonu ilgili modüle taşımadan önce türleri uyarlayın.",
      "Adapt the types before moving the sample function into a module.",
    ),
  ];
}

function requirementsFor(input: TaskInput, category: Category): string[] {
  const lang = input.languagePref;
  if (category === "automation") {
    return [
      L(lang, `${runtimeOf(input.focus)} çalıştırma ortamı`, `${runtimeOf(input.focus)} runtime`),
      L(
        lang,
        "Yazma izni yalnızca dosyayı bilerek ekleyecekseniz",
        "Write permission only if you intentionally add the file",
      ),
    ];
  }
  if (category === "sysadmin") {
    return [L(lang, "İlgili sistemde okuma yetkisi", "Read access on the target system")];
  }
  return [L(lang, input.language || "TypeScript", input.language || "TypeScript")];
}

function envFor(
  category: Category,
  lang: Lang,
): { name: string; purpose: string; required: boolean }[] {
  if (category !== "automation") return [];
  return [
    {
      name: "NEXTZEN_TARGET",
      purpose: L(
        lang,
        "Örneğin yazdırdığı hedef adı. Gizli değer koymayın.",
        "Target name printed by the sample. Do not put a secret here.",
      ),
      required: false,
    },
  ];
}

function finalText(input: TaskInput, category: Category): string {
  const lang = input.languagePref;
  return L(
    lang,
    `“${input.title}” demo kaydıdır. Kategori ${categoryLabel(category, lang)} olarak seçildi. Ayrıntı seviyesi ${input.detailLevel}. Güvenli önizleme ${input.safePreview ? "açık" : "kapalı"}. Gerçek model bağlandığında aynı şema korunur; bu metin modelmiş gibi sunulmaz.`,
    `“${input.title}” is a demo record. Category: ${categoryLabel(category, lang)}. Detail: ${input.detailLevel}. Safe preview is ${input.safePreview ? "on" : "off"}. A live model keeps the same schema; this text is not presented as one.`,
  );
}

function runtimeOf(focus: Focus): "python" | "bash" | "powershell" | "node" | "gha" {
  if (
    focus === "python" ||
    focus === "bash" ||
    focus === "powershell" ||
    focus === "node" ||
    focus === "gha"
  ) {
    return focus;
  }
  return "bash";
}

function focusLabel(focus: Focus, lang: Lang): string {
  const tr: Record<Focus, string> = {
    auto: "otomatik",
    generate: "kod üretme",
    explain: "açıklama ve inceleme",
    debug: "hata analizi",
    refactor: "refactoring",
    tests: "test üretme",
    design: "API veya dosya yapısı",
    security: "güvenlik ve performans",
    python: "Python",
    bash: "Bash",
    powershell: "PowerShell",
    node: "Node.js",
    gha: "GitHub Actions",
    resources: "kaynaklar",
    services: "servisler",
    disk: "disk, bellek, CPU",
    network: "ağ",
    permissions: "izinler",
    logs: "loglar",
    docker: "Docker",
    backup: "yedekleme",
  };
  const en: Record<Focus, string> = {
    auto: "automatic",
    generate: "code generation",
    explain: "explain and review",
    debug: "bug analysis",
    refactor: "refactoring",
    tests: "test generation",
    design: "API or file layout",
    security: "security and performance",
    python: "Python",
    bash: "Bash",
    powershell: "PowerShell",
    node: "Node.js",
    gha: "GitHub Actions",
    resources: "resources",
    services: "services",
    disk: "disk, memory, CPU",
    network: "network",
    permissions: "permissions",
    logs: "logs",
    docker: "Docker",
    backup: "backup",
  };
  return lang === "en" ? en[focus] : tr[focus];
}
