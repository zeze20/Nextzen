export const SCHEMA_VERSION = 1 as const;

export const CATEGORIES = ["software", "automation", "sysadmin"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_INPUTS = ["auto", "software", "automation", "sysadmin"] as const;
export type CategoryInput = (typeof CATEGORY_INPUTS)[number];

export const OS_TARGETS = ["any", "linux", "windows", "macos"] as const;
export type OsTarget = (typeof OS_TARGETS)[number];

export const DETAIL_LEVELS = ["brief", "standard", "detailed"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const FOCUSES = [
  "auto",
  "generate",
  "explain",
  "debug",
  "refactor",
  "tests",
  "design",
  "security",
  "python",
  "bash",
  "powershell",
  "node",
  "gha",
  "resources",
  "services",
  "disk",
  "network",
  "permissions",
  "logs",
  "docker",
  "backup",
] as const;
export type Focus = (typeof FOCUSES)[number];

export const STATUSES = ["completed", "awaiting_approval", "reviewed", "refused"] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const LANGS = ["tr", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const PRIVILEGES = ["none", "user", "admin"] as const;
export type Privilege = (typeof PRIVILEGES)[number];

export type RiskReason =
  | "delete"
  | "database"
  | "format"
  | "privilege"
  | "firewall"
  | "identity"
  | "production"
  | "force_git"
  | "cloud_destroy"
  | "secret"
  | "remote_exec"
  | "install"
  | "config"
  | "git_write"
  | "migration"
  | "service_change"
  | "malware";

export interface CommandProposal {
  purpose: string;
  os: string;
  command: string;
  privilege: Privilege;
  riskLevel: RiskLevel;
  impact: string;
  rollback: string;
  approvalRequired: boolean;
}

export interface Artifact {
  language: string;
  filename: string;
  content: string;
  purpose: string;
}

export interface EnvVarNote {
  name: string;
  purpose: string;
  required: boolean;
}

export type Reversible = "yes" | "partial" | "no";

export interface TaskResult {
  summary: string;
  assumptions: string[];
  plan: string[];
  riskLevel: RiskLevel;
  risks: string[];
  approvalRequired: boolean;
  affectedResources: string[];
  consequences: string[];
  reversible: Reversible;
  generatedArtifacts: Artifact[];
  commands: CommandProposal[];
  installationSteps: string[];
  validationSteps: string[];
  rollbackPlan: string[];
  warnings: string[];
  finalResponse: string;
  requirements: string[];
  envVars: EnvVarNote[];
  disableSteps: string[];
  refused: boolean;
}

export type TaskSource = "live" | "demo" | "policy";

export interface TaskRecord {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  description: string;
  categoryInput: CategoryInput;
  category: Category;
  os: OsTarget;
  language: string;
  detailLevel: DetailLevel;
  safePreview: boolean;
  projectContext: string;
  focus: Focus;
  createdAt: string;
  status: TaskStatus;
  riskLevel: RiskLevel;
  source: TaskSource;
  model: string | null;
  acknowledged: boolean;
  result: TaskResult;
}

export interface TaskInput {
  title: string;
  description: string;
  category: CategoryInput;
  os: OsTarget;
  language: string;
  detailLevel: DetailLevel;
  safePreview: boolean;
  projectContext: string;
  focus: Focus;
  languagePref: Lang;
}

export interface FieldErrors {
  title?: string;
  description?: string;
  projectContext?: string;
  language?: string;
}

export type GenerateCode =
  "validation" | "rate_limit" | "provider" | "invalid_output" | "timeout" | "unavailable";

export type GenerateResponse =
  | { ok: true; record: TaskRecord }
  | { ok: false; code: GenerateCode; message: string; fields?: FieldErrors };

export interface AiStatus {
  mode: "live" | "demo";
  model: string | null;
}
