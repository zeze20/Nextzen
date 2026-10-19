import type { Lang, RiskLevel, RiskReason } from "./types.ts";

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

const HIGH: { re: RegExp; reason: RiskReason }[] = [
  { re: /\brm\s+(-[a-z]*f|--force)\b/i, reason: "delete" },
  { re: /\b(unlink|rmdir|del|erase)\b/i, reason: "delete" },
  { re: /\bdrop\s+(table|database|schema)\b/i, reason: "database" },
  { re: /\btruncate\s+table\b/i, reason: "database" },
  { re: /\bdelete\s+from\b/i, reason: "database" },
  { re: /\bmkfs(\.\w+)?\b/i, reason: "format" },
  { re: /\bdd\s+if=/i, reason: "format" },
  { re: /\bformat\s+[a-z]:/i, reason: "format" },
  { re: /\b(sudo|visudo)\b/i, reason: "privilege" },
  { re: /\bchmod\s+777\b/i, reason: "privilege" },
  { re: /\bchown\s+-R\b/i, reason: "privilege" },
  { re: /\b(iptables|nftables|ufw|firewall-cmd)\b/i, reason: "firewall" },
  { re: /\b(useradd|userdel|passwd|net\s+user)\b/i, reason: "identity" },
  { re: /\b(production|prod ortam|canlı ortam|canli ortam)\b/i, reason: "production" },
  { re: /\bgit\s+push\b[^\n]*--force\b/i, reason: "force_git" },
  { re: /\bgit\s+reset\s+--hard\b/i, reason: "force_git" },
  {
    re: /\b(terraform\s+destroy|kubectl\s+delete|aws\s+\S+\s+(delete|terminate))\b/i,
    reason: "cloud_destroy",
  },
  { re: /\b(api[_ -]?key|secret|password|parola|credential|token)\b/i, reason: "secret" },
  { re: /\b(ssh\s+\S+@|ansible-playbook|docker\s+exec)\b/i, reason: "remote_exec" },
];

const MEDIUM: { re: RegExp; reason: RiskReason }[] = [
  { re: /\b(npm|pnpm|yarn)\s+(install|add|update)\b/i, reason: "install" },
  { re: /\b(pip|apt|apt-get|brew|choco)\s+install\b/i, reason: "install" },
  { re: /\b(migration|migrate)\b/i, reason: "migration" },
  { re: /\bgit\s+(commit|checkout|switch|branch|merge|rebase)\b/i, reason: "git_write" },
  {
    re: /\b(systemctl|service)\s+(restart|start|stop|enable|disable)\b/i,
    reason: "service_change",
  },
  { re: /\b(chmod|chown)\b/i, reason: "config" },
  {
    re: /\b(dosya\s+oluştur|dosya\s+olustur|config|yapılandır|yapilandir|\.env)\b/i,
    reason: "config",
  },
];

const MALWARE = [
  /reverse\s*shell/i,
  /ransomware/i,
  /keylogger/i,
  /credential\s*stuff/i,
  /phishing\s*kit/i,
  /\bmalware\b/i,
  /exploit\s+kit/i,
  /\bsqlmap\b/i,
  /yetkisiz\s+eri[sş]im\s+(sağla|sagla|al)/i,
  /\b(payload|shellcode)\b/i,
];

export interface RiskAssessment {
  level: RiskLevel;
  reasons: RiskReason[];
  malware: boolean;
}

export function assessRisk(text: string): RiskAssessment {
  const reasons: RiskReason[] = [];
  let level: RiskLevel = "low";
  const malware = MALWARE.some((re) => re.test(text));
  if (malware) {
    reasons.push("malware");
    level = "high";
  }
  for (const rule of HIGH) {
    if (rule.re.test(text) && !reasons.includes(rule.reason)) {
      reasons.push(rule.reason);
      level = "high";
    }
  }
  if (level !== "high") {
    for (const rule of MEDIUM) {
      if (rule.re.test(text) && !reasons.includes(rule.reason)) {
        reasons.push(rule.reason);
        level = "medium";
      }
    }
  }
  return { level, reasons, malware };
}

const REASON_TEXT: Record<RiskReason, Record<Lang, string>> = {
  delete: {
    tr: "Dosya veya veri silme izi var.",
    en: "The request mentions deleting files or data.",
  },
  database: {
    tr: "Veritabanında geri alınması zor bir işlem geçiyor.",
    en: "The request includes a hard-to-reverse database operation.",
  },
  format: {
    tr: "Disk biçimlendirme veya ham yazma izi var.",
    en: "The request mentions formatting a disk or raw device writes.",
  },
  privilege: {
    tr: "Yönetici veya kök yetkisi gerektiren bir ifade var.",
    en: "The request mentions administrator or root privileges.",
  },
  firewall: {
    tr: "Güvenlik duvarı veya ağ kuralı değişikliği geçiyor.",
    en: "The request mentions firewall or network rule changes.",
  },
  identity: {
    tr: "Kullanıcı veya parola yönetimi geçiyor.",
    en: "The request mentions user or password administration.",
  },
  production: {
    tr: "Canlı veya production ortamına işaret ediyor.",
    en: "The request points at a production environment.",
  },
  force_git: {
    tr: "Zorlayıcı bir Git işlemi geçiyor.",
    en: "The request includes a forced Git operation.",
  },
  cloud_destroy: {
    tr: "Bulut veya küme kaynağını silmeye yönelik bir işlem var.",
    en: "The request would destroy a cloud or cluster resource.",
  },
  secret: {
    tr: "Gizli bilgi, anahtar veya parola erişimi geçiyor.",
    en: "The request touches secrets, keys, or passwords.",
  },
  remote_exec: {
    tr: "Uzak sistemde komut çalıştırmaya işaret ediyor.",
    en: "The request points at running commands on a remote system.",
  },
  install: {
    tr: "Paket kurulumu ortamı değiştirir.",
    en: "Package installation changes the environment.",
  },
  config: {
    tr: "Dosya veya yapılandırma değişikliği önerilebilir.",
    en: "A file or configuration change may be proposed.",
  },
  git_write: {
    tr: "Git geçmişine yazan bir işlem geçiyor.",
    en: "The request includes a Git write operation.",
  },
  migration: {
    tr: "Şema veya veri göçü önerilebilir.",
    en: "A schema or data migration may be proposed.",
  },
  service_change: {
    tr: "Servis durumu değişebilir.",
    en: "A service state change may be proposed.",
  },
  malware: {
    tr: "İstek zararlı yazılım veya yetkisiz erişim içeriği taşıyor.",
    en: "The request asks for malware or unauthorized access.",
  },
};

export function reasonText(reason: RiskReason, lang: Lang): string {
  return REASON_TEXT[reason][lang];
}

export function parseRiskLevel(value: unknown): RiskLevel | null {
  if (typeof value !== "string") return null;
  const v = value.toLocaleLowerCase("tr");
  if (v.includes("high") || v.includes("yüksek") || v.includes("yuksek") || v === "yuksek") {
    return "high";
  }
  if (v.includes("medium") || v.includes("orta")) return "medium";
  if (v.includes("low") || v.includes("düşük") || v.includes("dusuk")) return "low";
  return null;
}
