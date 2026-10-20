import type { Lang, RiskLevel, RiskReason } from "./types.ts";

const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * JavaScript's `\b` only knows ASCII word characters, so it silently fails next to
 * Turkish letters (ı, ş, ğ, ü, ö, ç). These helpers use Unicode-aware boundaries.
 */
const L = "[\\p{L}\\p{N}_]";
function word(pattern: string): RegExp {
  // `\w*` is ASCII-only in JavaScript and would stop inside "duvarında"; use Unicode letters.
  const unicode = pattern.replaceAll("\\w*", `${L}*`);
  return new RegExp(`(?<!${L})(?:${unicode})(?!${L})`, "iu");
}
function raw(pattern: string): RegExp {
  return new RegExp(pattern, "iu");
}

/** Lowercase with the invariant locale, then drop the combining dot Turkish "İ" leaves behind. */
export function normalizeForScan(text: string): string {
  return text.toLowerCase().replace(/\u0307/g, "");
}

type Scope = "request" | "code";

interface Rule {
  re: RegExp;
  reason: RiskReason;
  level: RiskLevel | ((match: RegExpMatchArray, text: string) => RiskLevel);
  /** "request" rules read prose written by the user and never run on generated code. */
  only?: "request";
}

/** Paths whose modification can break or compromise the machine. */
const PROTECTED =
  "(?:/etc|/boot|/usr|/bin|/sbin|/lib|/lib64|/var/lib|/dev|/sys|/proc|/system|/library|c:\\\\windows|%systemroot%)";

/** Nouns that turn a vague Turkish/English verb ("sil", "kaldır") into a real system operation. */
const SYSTEM_OBJECT = raw(
  `(?<!${L})(?:dosya|klasör|klasor|dizin|disk|veritaban|tablo|sunucu|server|log(?:lar[\\p{L}]*|s)?(?![\\p{L}\\p{N}_])|yedek|backup|bucket|konteyner|container|imaj|image|volume|hesap|depo|repo|branch|paket|servis|kalıcı|kalici|geri alınamaz|geri alinamaz|tüm\\s|bütün\\s|hepsin|cache|önbellek|partition|cron|zamanlanmış|files?\\b|folders?\\b|director|database|all\\s)`,
);
const SERVER_OBJECT = raw(
  `(?<!${L})(?:sunucu|makine|bilgisayar|cihaz|server|machine|host|vm\\b|node\\b)`,
);

const byObject =
  (base: RiskLevel): ((m: RegExpMatchArray, text: string) => RiskLevel) =>
  (_m, text) =>
    SYSTEM_OBJECT.test(text) ? "high" : base;

const RULES: Rule[] = [
  // ───────────── High: deletion ─────────────
  { re: word("rm|srm|shred|unlink|rmdir|rimraf|del|erase|rd"), reason: "delete", level: "high" },
  { re: word("remove-item|clear-recyclebin|remove-localuser"), reason: "delete", level: "high" },
  { re: raw("\\bfind\\b[^\\n|;&]*\\s-delete\\b"), reason: "delete", level: "high" },
  { re: raw("(?:\\bxargs|-exec)\\s+(?:sudo\\s+)?rm\\b"), reason: "delete", level: "high" },
  { re: raw("\\btruncate\\s+-s\\s*0\\b"), reason: "delete", level: "high" },
  { re: raw("\\bcrontab\\s+-r\\b"), reason: "delete", level: "high" },
  {
    re: raw("\\bdocker\\s+(?:system|volume|image|container|network|builder)\\s+prune\\b"),
    reason: "delete",
    level: "high",
  },
  {
    re: raw("\\bdocker\\s+(?:rm|rmi|volume\\s+rm|network\\s+rm)\\b"),
    reason: "delete",
    level: "high",
  },
  {
    re: raw("\\bdocker[\\s-]compose\\s+down\\b[^\\n|;&]*(?:\\s-v\\b|--volumes)"),
    reason: "delete",
    level: "high",
  },
  { re: raw("\\bgit\\s+clean\\b[^\\n|;&]*\\s-[a-z]*f"), reason: "force_git", level: "high" },

  // ───────────── High: database ─────────────
  { re: word("drop\\s+(?:table|database|schema|index)"), reason: "database", level: "high" },
  {
    re: raw('\\btruncate\\s+table\\b|\\btruncate\\s+[\\w."`]+\\s*(?:;|\\n|$)'),
    reason: "database",
    level: "high",
  },
  { re: word("delete\\s+from"), reason: "database", level: "high" },
  { re: raw("\\balter\\s+table\\b[^;\\n]*\\bdrop\\b"), reason: "database", level: "high" },
  { re: word("flushall|flushdb|db\\.dropdatabase"), reason: "database", level: "high" },
  {
    re: raw('\\bupdate\\s+[\\w."`\\[\\]]+\\s+set\\b[^;]*'),
    reason: "database",
    level: (m) => (/\bwhere\b/i.test(m[0]) ? "medium" : "high"),
  },
  { re: word("insert\\s+into|replace\\s+into|merge\\s+into"), reason: "database", level: "medium" },

  // ───────────── High: disk / format ─────────────
  {
    re: word(
      "mkfs(?:\\.\\w+)?|wipefs|mkswap|fdisk|sfdisk|parted|gdisk|diskpart|format-volume|clear-disk|cryptsetup|lvremove|vgremove|zpool\\s+destroy",
    ),
    reason: "format",
    level: "high",
  },
  { re: raw("\\bdd\\b[^\\n|;&]*\\b(?:if|of)="), reason: "format", level: "high" },
  { re: raw(`(?<!${L})format\\s+[a-z]:(?!\\w)`), reason: "format", level: "high" },
  { re: raw(">{1,2}\\s*/dev/(?:sd|nvme|hd|vd|disk)"), reason: "format", level: "high" },

  // ───────────── High: privilege / identity ─────────────
  { re: word("sudo|visudo|doas|runas|pkexec"), reason: "privilege", level: "high" },
  {
    re: raw("(?<![\\p{L}\\p{N}_./-])su\\s+(?:-(?:\\s|$)|-l\\b|root\\b)"),
    reason: "privilege",
    level: "high",
  },
  { re: raw("-verb\\s+runas"), reason: "privilege", level: "high" },
  {
    re: raw("\\bchmod\\b[^\\n|;&]*(?:\\b0?777\\b|\\b[ug]\\+s\\b|a\\+rwx)"),
    reason: "privilege",
    level: "high",
  },
  {
    re: raw("\\b(?:chmod|chown|chgrp)\\s+(?:[^\\n|;&]*\\s)?-[a-z]*r"),
    reason: "privilege",
    level: "high",
  },
  {
    re: raw("\\b(?:chmod|chown|chgrp)\\b[^\\n|;&]*\\s/(?:\\s|$|\\*)"),
    reason: "privilege",
    level: "high",
  },
  {
    re: raw("\\busermod\\b[^\\n]*-a?g\\s*\\S*(?:sudo|wheel|admin)"),
    reason: "privilege",
    level: "high",
  },
  {
    re: raw("\\bicacls\\b[^\\n]*(?:/grant|/reset|/setowner)|\\btakeown\\b"),
    reason: "privilege",
    level: "high",
  },
  {
    re: word(
      "useradd|userdel|usermod|adduser|deluser|groupadd|groupdel|passwd|chpasswd|net\\s+user|net\\s+localgroup|new-localuser|add-localgroupmember|set-localuser|sysadminctl",
    ),
    reason: "identity",
    level: "high",
  },

  // ───────────── High: firewall / network / security controls ─────────────
  {
    re: word(
      "iptables|ip6tables|nftables|ufw|firewall-cmd|pfctl|netsh|new-netfirewallrule|set-netfirewallprofile|remove-netfirewallrule|set-netfirewallrule",
    ),
    reason: "firewall",
    level: "high",
  },
  {
    re: raw("\\bip\\s+(?:route|rule|addr|address|link)\\s+(?:add|del|delete|flush|replace|set)\\b"),
    reason: "firewall",
    level: "high",
  },
  {
    re: raw("\\b(?:ifconfig|ifdown|nmcli)\\b[^\\n]*\\b(?:down|delete|modify)\\b"),
    reason: "firewall",
    level: "high",
  },
  {
    re: raw(
      "\\bsetenforce\\s+(?:0|permissive)\\b|\\bset-mppreference\\b[^\\n]*disable|set-executionpolicy\\s+(?:unrestricted|bypass)|csrutil\\s+disable|\\bspctl\\b[^\\n]*--master-disable|\\bufw\\s+disable\\b|\\bsystemctl\\s+(?:stop|disable|mask)\\s+(?:firewalld|ufw|apparmor|auditd|fail2ban)",
    ),
    reason: "security_disable",
    level: "high",
  },

  // ───────────── High: remote execution / cloud ─────────────
  {
    re: raw(
      "(?<![\\p{L}\\p{N}_./~-])(?:sshpass|ssh|mosh|telnet)\\s+\\S|\\b(?:ansible|ansible-playbook|psexec|invoke-command|enter-pssession|new-pssession)\\b",
    ),
    reason: "remote_exec",
    level: "high",
  },
  {
    re: raw(
      "\\b(?:docker|kubectl|podman|oc|lxc)\\s+exec\\b|\\bdocker\\s+run\\b[^\\n]*--privileged",
    ),
    reason: "remote_exec",
    level: "high",
  },
  {
    re: raw("\\b(?:scp|rsync|sftp)\\b[^\\n|;&]*\\s\\S*@?[\\w.-]+:[~/\\w.-]"),
    reason: "remote_exec",
    level: "high",
  },
  {
    re: raw(
      "\\bterraform\\s+(?:destroy|taint)\\b|\\bkubectl\\s+delete\\b|\\bhelm\\s+(?:uninstall|delete)\\b|\\bpulumi\\s+destroy\\b|\\bgcloud\\b[^\\n]*\\bdelete\\b|\\baz\\s+[a-z-]+[^\\n]*\\bdelete\\b|\\baws\\s+[a-z0-9-]+[^\\n]*\\b(?:delete|terminate|rm|remove|deregister)\\S*",
    ),
    reason: "cloud_destroy",
    level: "high",
  },
  {
    re: raw(
      "\\bterraform\\s+(?:apply|import|state\\s+rm)\\b|\\bpulumi\\s+up\\b|\\bcdk\\s+deploy\\b|\\bkubectl\\s+(?:apply|drain|cordon|scale|patch|replace|rollout|create)\\b|\\bhelm\\s+(?:install|upgrade|rollback)\\b|\\bgcloud\\b[^\\n]*\\bcreate\\b|\\baz\\s+[a-z-]+[^\\n]*\\bcreate\\b|\\baws\\s+[a-z0-9-]+[^\\n]*\\b(?:create|run-instances|put|update|modify|start)\\S*|\\beksctl\\s+create\\b|\\bserverless\\s+deploy\\b|\\bvercel\\b[^\\n]*--prod\\b|\\bfly\\s+deploy\\b",
    ),
    reason: "cloud_change",
    level: "high",
  },

  // ───────────── High: power / pipes into an interpreter / protected paths ─────────────
  {
    re: raw(
      "(?:^|[;&|(]\\s*|\\bsudo\\s+)(?:shutdown|reboot|poweroff|restart-computer|stop-computer)\\b|\\binit\\s+[06]\\b|\\bsystemctl\\s+(?:reboot|poweroff|halt)\\b",
    ),
    reason: "power",
    level: "high",
  },
  {
    re: raw(
      "\\b(?:curl|wget|iwr|invoke-webrequest)\\b[^\\n]*\\|\\s*(?:sudo\\s+)?(?:(?:ba|z|da|k|c)?sh|python[\\d.]*|node|perl|ruby|php|iex|invoke-expression)\\b",
    ),
    reason: "remote_script",
    level: "high",
  },
  {
    re: raw(
      "\\|\\s*(?:iex|invoke-expression)\\b|\\b(?:iex|invoke-expression)\\b\\s*\\(?\\s*\\(?\\s*(?:iwr|invoke-webrequest|new-object\\s+net\\.webclient|curl|wget)|\\b(?:ba|z|da)?sh\\s+(?:-c\\s+[\"']?\\$\\(\\s*(?:curl|wget)|<\\(\\s*(?:curl|wget))",
    ),
    reason: "remote_script",
    level: "high",
  },
  { re: raw(">{1,2}\\s*" + PROTECTED), reason: "system_write", level: "high" },
  {
    re: raw(
      "(?:^|[;&|]\\s*|\\bsudo\\s+)(?:mv|cp|tee|install|ln|sed\\s+-i\\S*|touch|mkdir|set-content|out-file|add-content|new-item)\\b[^\\n|;&]*" +
        PROTECTED,
    ),
    reason: "system_write",
    level: "high",
  },

  // ───────────── High: git history / forced ─────────────
  {
    re: raw(
      "\\bgit\\s+push\\b[^\\n]*(?:\\s-f\\b|\\s--force\\b|--force-with-lease|\\s\\+\\S+|\\s--delete\\b|\\s:\\S+)",
    ),
    reason: "force_git",
    level: "high",
  },
  {
    re: raw(
      "\\bgit\\s+reset\\s+--hard\\b|\\bgit\\s+branch\\s+-d\\b|\\bgit\\s+stash\\s+(?:drop|clear)\\b|\\bgit\\s+reflog\\s+expire\\b|\\bgit\\s+gc\\s+--prune\\b|\\bgit\\s+filter-(?:branch|repo)\\b|\\bgit\\s+(?:checkout|restore)\\s+(?:--\\s+)?\\.(?=\\s|$|;|&)",
    ),
    reason: "force_git",
    level: "high",
  },

  // ───────────── High: concrete secret exposure ─────────────
  {
    re: raw(
      "\\b(?:cat|type|less|more|head|tail|grep|get-content|gc|cp|scp|base64)\\b[^\\n|;&]*(?:\\.env\\b|id_rsa|id_ed25519|id_ecdsa|\\.pem\\b|\\.aws/credentials|/etc/shadow|\\.netrc|\\.pgpass|\\.npmrc|\\.kube/config|\\.docker/config\\.json)",
    ),
    reason: "secret",
    level: "high",
  },
  {
    re: raw(
      "\\b(?:printenv|security\\s+find-generic-password|get-credential|convertfrom-securestring|cmdkey\\s+/list|vaultcmd|mimikatz)\\b|\\bget-childitem\\s+env:",
    ),
    reason: "secret",
    level: "high",
  },
  {
    // Literal secret assignment, in the four shapes a shell user actually types.
    // Plain code (`const password = form.password`) and prose ("Token süresi 15 dk") are not matched.
    re: raw(
      [
        "(?:^|[;&|]\\s*)(?:export|set)\\s+[a-z0-9_]*(?:api_?key|secret|passw(?:or)?d|token|credential)[a-z0-9_]*\\s*=\\s*['\"]?(?!<|\\$|\\{|your|xxx|change|place|example|\\.\\.\\.|\\*|\\[|%|process\\.|os\\.|env\\.|getenv|environ|form\\.|req\\.|input|args)[a-z0-9/+_.:-]{3,}",
        "\\bsetx\\s+[a-z0-9_]*(?:api_?key|secret|passw(?:or)?d|token|credential)[a-z0-9_]*\\s+['\"]?(?!<|\\$|\\{|your|xxx|change|place|example|\\.\\.\\.|\\*|\\[|%|process\\.|os\\.|env\\.|getenv|environ|form\\.|req\\.|input|args)[a-z0-9/+_.:-]{3,}",
        "\\$env:[a-z0-9_]*(?:api_?key|secret|passw(?:or)?d|token|credential)[a-z0-9_]*\\s*=\\s*['\"]?(?!<|\\$|\\{|your|xxx|change|place|example|\\.\\.\\.|\\*|\\[|%|process\\.|os\\.|env\\.|getenv|environ|form\\.|req\\.|input|args)[a-z0-9/+_.:-]{3,}",
        "(?:^|\\n)[ \\t]*[a-z0-9_]*(?:api_?key|secret|passw(?:or)?d|token|credential)[a-z0-9_]*=['\"]?(?!<|\\$|\\{|your|xxx|change|place|example|\\.\\.\\.|\\*|\\[|%|process\\.|os\\.|env\\.|getenv|environ|form\\.|req\\.|input|args)[a-z0-9/+_.:-]{3,}",
      ].join("|"),
    ),
    reason: "secret",
    level: "high",
  },
  {
    re: raw("\\b(?:ghp|gho|ghu|ghs|ghr)_[a-z0-9]{20,}|\\bgithub_pat_[a-z0-9_]{20,}"),
    reason: "leaked_secret",
    level: "high",
  },
  {
    re: raw(
      "\\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[a-z0-9]{20,}|\\bxai-[a-z0-9]{20,}|\\bakia[0-9a-z]{16}\\b|\\bxox[abprs]-[a-z0-9-]{10,}|-----begin [a-z ]*private key-----|\\beyj[a-z0-9_-]{10,}\\.[a-z0-9_-]{10,}\\.[a-z0-9_-]{10,}",
    ),
    reason: "leaked_secret",
    level: "high",
  },

  // ───────────── Medium: environment / configuration changes ─────────────
  {
    re: raw(
      "\\b(?:npm|pnpm|yarn|bun)\\s+(?:install|i|add|update|upgrade|remove|uninstall|link)\\b|\\bnpx\\s+\\S+",
    ),
    reason: "install",
    level: "medium",
  },
  {
    re: raw(
      "\\b(?:pip|pip3|pipx|conda|poetry|gem|cargo|composer)\\s+(?:install|add|update|upgrade|remove|uninstall)\\b|\\bgo\\s+install\\b|\\buv\\s+pip\\s+install\\b|\\bdotnet\\s+add\\s+package\\b",
    ),
    reason: "install",
    level: "medium",
  },
  {
    re: raw(
      "\\b(?:apt|apt-get|aptitude|dnf|yum|zypper|pacman|apk|snap|flatpak|brew|port|choco|winget|scoop|nix-env)\\s+(?:install|upgrade|update|remove|uninstall|-s)\\b|\\b(?:install-module|install-package|install-windowsfeature|enable-windowsoptionalfeature)\\b",
    ),
    reason: "install",
    level: "medium",
  },
  {
    re: word(
      "migrations?|migrate|alembic|flyway|liquibase|prisma\\s+(?:migrate|db\\s+push)|knex\\s+migrate|db:migrate",
    ),
    reason: "migration",
    level: "medium",
  },
  {
    re: raw(
      "\\bgit\\s+(?:commit|checkout|switch|branch|merge|rebase|cherry-pick|tag|add|stash|pull|push|restore|revert|am|apply|mv|rm|submodule)\\b",
    ),
    reason: "git_write",
    level: "medium",
  },
  {
    re: raw(
      "\\b(?:systemctl|service|launchctl|sc|net)\\s+(?:restart|start|stop|enable|disable|mask|unmask|daemon-reload|reload|kill|load|unload|bootout|bootstrap|pause|continue)\\b|\\b(?:restart|stop|start|set)-service\\b",
    ),
    reason: "service_change",
    level: "medium",
  },
  {
    re: raw(
      "\\bsystemctl\\s+(?:stop|disable|mask|restart)\\s+(?:ssh|sshd|network|networking|networkmanager|systemd-networkd|docker)\\b",
    ),
    reason: "service_change",
    level: "high",
  },
  {
    re: raw(
      "\\bdocker\\s+(?:stop|restart|kill|pause|start|compose\\s+(?:up|down|restart|stop)|build|pull|push|tag|commit|run|create)\\b",
    ),
    reason: "service_change",
    level: "medium",
  },
  {
    re: raw(
      `(?:^|[\\s;&|(])(?:kill|pkill|killall|taskkill|stop-process|xkill)(?![\\p{L}\\p{N}_])(?!\\s*\\()`,
    ),
    reason: "process_kill",
    level: "medium",
  },
  {
    re: word("chmod|chown|chgrp|chattr|attrib|icacls|setfacl|umask"),
    reason: "config",
    level: "medium",
  },
  {
    re: raw(
      "(?:^|[;&|]\\s*|\\bsudo\\s+)(?:mv|cp|ln|touch|mkdir|tee|rename-item|move-item|copy-item|set-content|add-content|out-file|new-item|set-itemproperty|mount|umount|modprobe|insmod|rmmod|swapoff|swapon)\\b|\\bsed\\s+-i\\S*|\\bperl\\s+-pi\\S*|\\bcrontab\\s+-e\\b|\\bschtasks\\s+/create\\b|\\bsysctl\\s+-w\\b|\\bdefaults\\s+write\\b|\\breg\\s+(?:add|delete|import)\\b|\\bsetx\\b|\\bexport\\s+\\w+=",
    ),
    reason: "config",
    level: "medium",
  },
  {
    // Shell redirection into a file (not JSX/arrow functions/comparisons).
    re: raw(
      "(?:^|\\s)\\d?>>?\\s*(?!/dev/null|&)(?:/|~|\\./|\\.\\./|\\$\\w|[a-z0-9_-]+\\.(?:txt|log|conf|cfg|ini|json|ya?ml|env|sh|ps1|csv|md|out|sql|bak)(?![\\p{L}\\p{N}_]))",
    ),
    reason: "config",
    level: "medium",
  },
  {
    re: raw(
      "\\b(?:curl|wget|iwr|invoke-webrequest)\\b[^\\n|;&]*(?:\\s-o\\s*[^\\s-]|\\s--output|\\s-outfile|\\s-x\\s+(?:post|put|delete|patch)|\\s--data|\\s-d\\s)",
    ),
    reason: "config",
    level: "medium",
  },

  // ───────────── Request-only: prose written by the user (Turkish and English) ─────────────
  {
    only: "request",
    re: word(
      "production(?!\\s*-?\\s*(?:build|mode|ready|bundle|dependenc\\w*|deps|config\\w*))|prod(?!\\s*-?\\s*(?:build|mode|ready))|prod\\s+ortam\\w*|canl[ıi]\\s+(?:ortam|sunucu|sistem|veri)\\w*|üretim\\s+ortam\\w*|uretim\\s+ortam\\w*|live\\s+(?:server|environment|system)",
    ),
    reason: "production",
    level: "high",
  },
  {
    only: "request",
    re: raw(
      `(?<![\\p{L}\\p{N}_./~-])ssh\\s+(?:ile|key|bağlan\\w*|connect\\w*|into|to)(?!${L})|(?<!${L})(?:uzak\\s+(?:sunucu|sistem|makine|bilgisayar)\\w*|remote\\s+(?:server|host|machine|system))`,
    ),
    reason: "remote_exec",
    level: "high",
  },
  {
    only: "request",
    re: word(
      "kök\\s+yetki\\w*|root\\s+yetki\\w*|yönetici\\s+(?:olarak|yetki\\w*|hakları)|administrator\\s+(?:rights|privileges)|run\\s+as\\s+(?:root|admin\\w*)|root\\s+(?:access|olarak)",
    ),
    reason: "privilege",
    level: "high",
  },
  {
    only: "request",
    re: word("güvenlik\\s+duvar\\w*|guvenlik\\s+duvar\\w*|firewall|port\\s+(?:aç|kapat)\\w*"),
    reason: "firewall",
    level: "high",
  },
  {
    only: "request",
    re: word(
      "kullanıcı\\s+(?:ekle|oluştur|sil|yetki)\\w*|kullanici\\s+(?:ekle|olustur|sil|yetki)\\w*|(?:şifre|parola)(?:yı|yi)?\\s+(?:sıfırla|değiştir)\\w*",
    ),
    reason: "identity",
    level: "high",
  },
  {
    only: "request",
    re: word(
      "sil(?:|in|me|mek|ip|erek|er|sin|insin|inmesi|inir|elim|dir|diğim|eceğim|ecek|iniz|dikten|indi|mem|meli)|kaldır(?:|ma|mak|ın|ıp|arak|sın|alım|malı|dık|acağım|ır)|yok\\s+et\\w*|imha\\s+\\w*",
    ),
    reason: "delete",
    level: byObject("medium"),
  },
  {
    // English verbs only count when they directly act on a real system resource.
    only: "request",
    re: word(
      "(?:delete|remove|erase|wipe|purge|destroy)\\s+(?:(?:the|all|old|every|these|those|my|your|any|stale|temp|temporary|unused|existing|entire|whole)\\s+)*(?:files?|folders?|director(?:y|ies)|databases?|backups?|logs?|volumes?|containers?|buckets?|users?|accounts?|repos?|repositories|branch(?:es)?|servers?|data|records|tables?|images?|snapshots?|clusters?|instances?)",
    ),
    reason: "delete",
    level: "high",
  },
  {
    only: "request",
    re: word(
      "temizle(?:|me|mek|yip|yerek|n|sin|yin)|temizlik\\w*|boşalt\\w*|bosalt\\w*|clean\\s*up|cleanup",
    ),
    reason: "delete",
    level: (_m, text) => (SYSTEM_OBJECT.test(text) ? "high" : "low"),
  },
  {
    only: "request",
    re: word(
      "yeniden\\s+başlat\\w*|yeniden\\s+baslat\\w*|restart\\w*|reboot|shutdown|kapat(?:ma|mak|ın|sın)?",
    ),
    reason: "power",
    level: (_m, text) => (SERVER_OBJECT.test(text) ? "high" : "low"),
  },
  {
    only: "request",
    re: word("yeniden\\s+başlat\\w*|yeniden\\s+baslat\\w*|restart\\w*"),
    reason: "service_change",
    level: (_m, text) => (SERVER_OBJECT.test(text) ? "low" : "medium"),
  },
  {
    only: "request",
    re: word(
      "paket\\w*\\s+(?:kur|yükle|güncelle)\\w*|bağımlılık\\w*\\s+(?:kur|yükle|güncelle)\\w*|kurulum\\s+yap\\w*",
    ),
    reason: "install",
    level: "medium",
  },
  {
    only: "request",
    re: word(
      "servis\\w*\\s+(?:durdur|başlat|yeniden)\\w*|(?:süreç|süreci|işlem|işlemi|process)\\s+(?:öldür|sonlandır|kill)\\w*",
    ),
    reason: "service_change",
    level: "medium",
  },
  {
    only: "request",
    re: word(
      "dosya\\w*\\s+(?:oluştur|olustur|değiştir|degistir|düzenle|duzenle|yaz|taşı|tasi|kopyala)\\w*|yapılandır\\w*|yapilandir\\w*|ayar\\w*\\s+(?:değiştir|degistir|güncelle)\\w*|config\\w*|\\.env",
    ),
    reason: "config",
    level: "medium",
  },
  {
    // Merely mentioning secrets is context, not access.
    only: "request",
    re: word(
      "api[_ -]?key|secret|passw(?:or)?d|parola|şifre|sifre|credential\\w*|token|private\\s+key|özel\\s+anahtar|ssh\\s+key",
    ),
    reason: "secret",
    level: "medium",
  },
];

/* ───────────────────────── Malware / abuse policy ───────────────────────── */

const HARD_TERMS: RegExp[] = [
  word("reverse[\\s-]*shells?|bind[\\s-]*shells?|web[\\s-]*shells?"),
  word("ransomwares?|fidye\\s+yazılım\\w*"),
  word("keyloggers?|key[\\s-]*loggers?"),
  word("credential[\\s-]*stuffing"),
  word("phishing[\\s-]*(?:kits?|pages?|sayfa\\w*|site\\w*)"),
  word("exploit[\\s-]*kits?|shellcodes?|meterpreter|msfvenom|cobalt\\s*strike|mimikatz"),
  word(
    "malwares?|zararlı\\s+yazılım\\w*|virüs\\s+yaz\\w*|trojans?|botnets?|rootkits?|backdoors?|arka\\s+kapı\\w*",
  ),
  word("ddos\\s+(?:saldırı\\w*|aracı|tool|script|attack)"),
  word("yetkisiz\\s+eri[sş]im\\s*(?:sağla|sagla|al)\\w*|unauthorized\\s+access"),
];
const FORK_BOMB = raw(":\\(\\)\\s*\\{\\s*:\\s*\\|\\s*:\\s*&\\s*\\}\\s*;\\s*:");
const DUAL_USE: RegExp[] = [
  word(
    "sqlmap|nmap|metasploit|hydra|john\\s+the\\s+ripper|hashcat|burp\\s*suite|nikto|aircrack\\S*",
  ),
];
const BUILD_VERBS = word(
  "write|create|build|develop|make|generate|code|craft|deploy|spread|drop|launch|run|use|implement|hazırla\\w*|yaz\\w*|oluştur\\w*|geliştir\\w*|üret\\w*|bırak\\w*|yay\\w*|çalıştır\\w*|kodla\\w*|yap\\w*",
);
const DEFENSIVE = word(
  "detect\\w*|detection|analy[sz]\\w*|remov\\w*|protect\\w*|prevent\\w*|defen[cs]\\w*|scan\\w*|mitigat\\w*|incident|forensic\\w*|sandbox\\w*|yara|sigma|edr|antivir\\w*|tespit\\w*|önle\\w*|onle\\w*|koru\\w*|analiz\\w*|savun\\w*|incele\\w*|algıla\\w*|algila\\w*|engelle\\w*|temizle\\w*|what\\s+is|nedir|how\\s+does|nasıl\\s+çalış\\w*|explain|açıkla\\w*|acikla\\w*|ne\\s+yapar|what\\s+does|educat\\w*|öğren\\w*|ogren\\w*|awareness|farkındalık\\w*",
);
const ATTACK = word(
  "victim|kurban|target\\s+(?:system|machine|server)|karşı\\s+sistem\\w*|hedef\\s+sistem\\w*|without\\s+(?:permission|consent|authorization)|izinsiz|yetkisiz|unauthori[sz]ed|evad\\w*|bypass\\s+(?:antivirus|av|edr|defender)|persistence|exfiltrat\\w*|steal\\w*|çal(?:ma|mak|ıp|arak|sın)\\b|gizle\\w*\\s+(?:izle|kendini)|spread\\s+(?:to|across)|bulaştır\\w*|ele\\s+geçir\\w*",
);

export interface RiskAssessment {
  level: RiskLevel;
  reasons: RiskReason[];
  malware: boolean;
}

function malwareVerdict(text: string): { refuse: boolean; topic: boolean } {
  // A fork bomb is hostile on its own; only an explicit "explain this" framing downgrades it.
  if (FORK_BOMB.test(text)) {
    const explaining = DEFENSIVE.test(text);
    return { refuse: !explaining, topic: explaining };
  }
  const hard = HARD_TERMS.some((re) => re.test(text));
  const dual = DUAL_USE.some((re) => re.test(text));
  if (!hard && !dual) return { refuse: false, topic: false };
  const attack = ATTACK.test(text);
  const build = BUILD_VERBS.test(text);
  const defensive = DEFENSIVE.test(text);
  // Hard-blocked terms: refuse when the wording shows offensive intent, or asks to build
  // the thing with no defensive framing. Dual-use tools only refuse with explicit attack intent.
  const refuse = hard ? attack || (build && !defensive) : attack;
  return { refuse, topic: !refuse };
}

function scan(text: string, scope: Scope): { level: RiskLevel; reasons: RiskReason[] } {
  const reasons: RiskReason[] = [];
  let level: RiskLevel = "low";
  for (const rule of RULES) {
    if (rule.only === "request" && scope !== "request") continue;
    const match = text.match(rule.re);
    if (!match) continue;
    const next = typeof rule.level === "function" ? rule.level(match, text) : rule.level;
    if (next === "low") continue;
    if (!reasons.includes(rule.reason)) reasons.push(rule.reason);
    level = maxRisk(level, next);
  }
  return { level, reasons };
}

function combine(
  parts: { level: RiskLevel; reasons: RiskReason[] }[],
  verdict: { refuse: boolean; topic: boolean },
): RiskAssessment {
  const reasons: RiskReason[] = [];
  let level: RiskLevel = "low";
  if (verdict.refuse) {
    reasons.push("malware");
    level = "high";
  } else if (verdict.topic) {
    reasons.push("security_topic");
    level = "medium";
  }
  for (const part of parts) {
    level = maxRisk(level, part.level);
    for (const reason of part.reasons) if (!reasons.includes(reason)) reasons.push(reason);
  }
  return { level, reasons, malware: verdict.refuse };
}

/**
 * Assess one piece of text.
 * - "request": prose the user wrote (Turkish and English phrases count).
 * - "code": commands, scripts, or pasted code. Prose-only rules are skipped so that
 *   identifiers like `config`, `password`, or a "Sil" button label do not raise alarms.
 */
export function assessRisk(input: string, scope: Scope = "request"): RiskAssessment {
  const text = normalizeForScan(input);
  return combine([scan(text, scope)], malwareVerdict(text));
}

/** Assess a whole task: title and description are prose, project context is pasted code. */
export function assessInput(parts: {
  title: string;
  description: string;
  projectContext: string;
}): RiskAssessment {
  const request = normalizeForScan(`${parts.title}\n${parts.description}`);
  const context = normalizeForScan(parts.projectContext);
  return combine(
    [scan(request, "request"), scan(context, "code")],
    malwareVerdict(`${request}\n${context}`),
  );
}

const REASON_TEXT: Record<RiskReason, Record<Lang, string>> = {
  delete: {
    tr: "Dosya veya veri silme izi var.",
    en: "The request mentions deleting files or data.",
  },
  database: {
    tr: "Veritabanında veri değiştiren veya geri alınması zor bir işlem geçiyor.",
    en: "The request includes a database operation that changes data or is hard to reverse.",
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
    tr: "Zorlayıcı veya geçmişi değiştiren bir Git işlemi geçiyor.",
    en: "The request includes a forced or history-rewriting Git operation.",
  },
  cloud_destroy: {
    tr: "Bulut veya küme kaynağını silmeye yönelik bir işlem var.",
    en: "The request would destroy a cloud or cluster resource.",
  },
  cloud_change: {
    tr: "Bulut kaynağı oluşturabilir veya değiştirebilir; maliyet doğurabilir.",
    en: "The request may create or change cloud resources and incur cost.",
  },
  secret: {
    tr: "Gizli bilgi, anahtar veya parola ile ilgili bir ifade geçiyor.",
    en: "The request touches secrets, keys, or passwords.",
  },
  leaked_secret: {
    tr: "Metinde gerçek bir anahtar veya token var. Hemen iptal edin ve yenisini üretin.",
    en: "The text contains what looks like a real key or token. Revoke it now and issue a new one.",
  },
  remote_exec: {
    tr: "Uzak sistemde komut çalıştırmaya işaret ediyor.",
    en: "The request points at running commands on a remote system.",
  },
  remote_script: {
    tr: "İnternetten indirilen betik doğrudan çalıştırılıyor. Önce indirip inceleyin.",
    en: "A downloaded script is piped straight into an interpreter. Download and read it first.",
  },
  power: {
    tr: "Makineyi kapatır veya yeniden başlatır; kesinti doğurur.",
    en: "This shuts down or reboots the machine and causes downtime.",
  },
  process_kill: {
    tr: "Çalışan bir süreci sonlandırabilir.",
    en: "This may terminate a running process.",
  },
  system_write: {
    tr: "Sistem dizinlerine yazan bir işlem var.",
    en: "The request writes to protected system paths.",
  },
  security_disable: {
    tr: "Bir güvenlik kontrolünü devre dışı bırakıyor.",
    en: "The request disables a security control.",
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
  security_topic: {
    tr: "Güvenlik veya saldırı aracı konusu geçiyor. Yalnızca savunma ve yetkili test amacıyla kullanın.",
    en: "The request touches security or attack tooling. Use it for defense and authorized testing only.",
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
