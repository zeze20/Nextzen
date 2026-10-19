import type { Category, CategoryInput, Focus } from "./types.ts";

const SOFTWARE = [
  /kod/i,
  /code/i,
  /bug/i,
  /hata/i,
  /refactor/i,
  /test/i,
  /api/i,
  /react/i,
  /typescript/i,
  /python/i,
  /fonksiyon/i,
  /function/i,
  /bileşen/i,
  /bilesen/i,
  /incele/i,
];

const AUTOMATION = [
  /otomasyon/i,
  /automation/i,
  /cron/i,
  /github actions/i,
  /workflow/i,
  /powershell/i,
  /\bbash\b/i,
  /zamanlan/i,
  /schedule/i,
  /betik/i,
  /\bscript\b/i,
];

const SYSADMIN = [
  /docker/i,
  /systemd/i,
  /systemctl/i,
  /disk/i,
  /bellek/i,
  /\bcpu\b/i,
  /nginx/i,
  /\blog\b/i,
  /izin/i,
  /permission/i,
  /yedek/i,
  /backup/i,
  /ağ/i,
  /\bag\b/i,
  /network/i,
  /\bufw\b/i,
  /servis/i,
  /service/i,
];

function score(text: string, rules: RegExp[]): number {
  return rules.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
}

export function detectCategory(text: string, input: CategoryInput): Category {
  if (input !== "auto") return input;
  const software = score(text, SOFTWARE);
  const automation = score(text, AUTOMATION);
  const sysadmin = score(text, SYSADMIN);
  const best = Math.max(software, automation, sysadmin);
  if (best === 0) return "software";
  if (sysadmin === best && sysadmin > software) return "sysadmin";
  if (automation === best && automation >= software) return "automation";
  return "software";
}

const SOFTWARE_FOCUSES: Focus[] = [
  "auto",
  "generate",
  "explain",
  "debug",
  "refactor",
  "tests",
  "design",
  "security",
];
const AUTOMATION_FOCUSES: Focus[] = ["auto", "python", "bash", "powershell", "node", "gha"];
const SYSADMIN_FOCUSES: Focus[] = [
  "auto",
  "resources",
  "services",
  "disk",
  "network",
  "permissions",
  "logs",
  "docker",
  "backup",
];

export function focusesFor(category: CategoryInput): Focus[] {
  if (category === "software") return SOFTWARE_FOCUSES;
  if (category === "automation") return AUTOMATION_FOCUSES;
  if (category === "sysadmin") return SYSADMIN_FOCUSES;
  return [
    "auto",
    ...SOFTWARE_FOCUSES.slice(1),
    ...AUTOMATION_FOCUSES.slice(1),
    ...SYSADMIN_FOCUSES.slice(1),
  ];
}
