import { applyQuality } from "./quality.ts";
import { assessInput, assessRisk, maxRisk, parseRiskLevel, reasonText } from "./risk.ts";
import { sanitizeList, sanitizeText } from "./sanitize.ts";
import type {
  Artifact,
  CommandProposal,
  EnvVarNote,
  Lang,
  OsTarget,
  Privilege,
  Reversible,
  RiskLevel,
  TaskResult,
} from "./types.ts";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function privilegeOf(value: unknown): Privilege {
  const text = sanitizeText(value, 20).toLowerCase();
  if (text === "admin" || text === "root" || text === "yönetici") return "admin";
  if (text === "user" || text === "kullanıcı") return "user";
  return "none";
}

function reversibleOf(value: unknown, level: RiskLevel): Reversible {
  const text = sanitizeText(value, 20).toLowerCase();
  let parsed: Reversible = "partial";
  if (text === "yes" || text === "evet" || text === "true") parsed = "yes";
  else if (text === "no" || text === "hayır" || text === "hayir" || text === "false") parsed = "no";
  else if (text === "partial" || text === "kısmen" || text === "kismen") parsed = "partial";
  if (level === "high" && parsed === "yes") return "partial";
  return parsed;
}

function artifactsOf(value: unknown): Artifact[] {
  if (!Array.isArray(value)) return [];
  const out: Artifact[] = [];
  for (const item of value.slice(0, 6)) {
    const row = asRecord(item);
    const content = sanitizeText(row.content, 12000);
    if (!content) continue;
    out.push({
      language: sanitizeText(row.language, 40) || "text",
      filename: sanitizeText(row.filename, 120) || "cikti.txt",
      content,
      purpose: sanitizeText(row.purpose, 400) || "",
    });
  }
  return out;
}

function commandsOf(value: unknown): CommandProposal[] {
  if (!Array.isArray(value)) return [];
  const out: CommandProposal[] = [];
  for (const item of value.slice(0, 8)) {
    const row = asRecord(item);
    const command = sanitizeText(row.command, 4000);
    if (!command) continue;
    const scanned = assessRisk(command, "code");
    const stated = parseRiskLevel(row.riskLevel) ?? "low";
    const riskLevel = maxRisk(stated, scanned.level);
    const privilege = privilegeOf(row.privilege);
    const elevated = privilege === "admin" ? maxRisk(riskLevel, "high") : riskLevel;
    out.push({
      purpose: sanitizeText(row.purpose, 400) || command.slice(0, 80),
      os: sanitizeText(row.os, 40) || "any",
      command,
      privilege,
      riskLevel: elevated,
      impact: sanitizeText(row.impact, 600) || "",
      rollback: sanitizeText(row.rollback, 600) || "",
      approvalRequired: elevated === "high" || row.approvalRequired === true,
    });
  }
  return out;
}

function envOf(value: unknown): EnvVarNote[] {
  if (!Array.isArray(value)) return [];
  const out: EnvVarNote[] = [];
  for (const item of value.slice(0, 12)) {
    const row = asRecord(item);
    const name = sanitizeText(row.name, 80);
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) continue;
    out.push({
      name,
      purpose: sanitizeText(row.purpose, 300),
      required: row.required === true,
    });
  }
  return out;
}

export interface NormalizeOptions {
  /** Pasted project context. Scanned as code, not as prose, so identifiers do not raise alarms. */
  contextText?: string;
  targetOs?: OsTarget;
}

export function normalizeModelPayload(
  raw: unknown,
  lang: Lang,
  floorText: string,
  options: NormalizeOptions = {},
): TaskResult {
  const row = asRecord(raw);
  const floor = assessInput({
    title: "",
    description: floorText,
    projectContext: options.contextText ?? "",
  });
  const commandList = commandsOf(row.commands);
  const artifactList = artifactsOf(row.generatedArtifacts);
  const generated = [
    ...commandList.map((command) => command.command),
    ...artifactList.map((artifact) => artifact.content),
  ].join("\n");
  const scanned = assessRisk(generated, "code");
  const modelLevel = parseRiskLevel(row.riskLevel) ?? "low";
  const riskLevel = [
    floor.level,
    scanned.level,
    modelLevel,
    ...commandList.map((c) => c.riskLevel),
  ].reduce(maxRisk, "low" as RiskLevel);
  const refused = row.refused === true || floor.malware;
  const approvalRequired =
    !refused && (riskLevel === "high" || commandList.some((c) => c.approvalRequired));
  const reasonLines = [...new Set([...floor.reasons, ...scanned.reasons])].map((reason) =>
    reasonText(reason, lang),
  );
  const summary =
    sanitizeText(row.summary, 2000) ||
    (lang === "en" ? "The model returned no summary." : "Model özet döndürmedi.");
  const fallbackGap =
    lang === "en"
      ? "This section was empty. Review it before use."
      : "Bu bölüm boştu. Kullanmadan önce denetleyin.";
  const assumptions = sanitizeList(row.assumptions, 8, 500);
  const plan = sanitizeList(row.plan, 12, 500);
  const warnings = [...sanitizeList(row.warnings, 8, 500), ...reasonLines].slice(0, 12);
  const result: TaskResult = {
    summary,
    assumptions: assumptions.length ? assumptions : [fallbackGap],
    plan: plan.length ? plan : [fallbackGap],
    riskLevel,
    risks: [...sanitizeList(row.risks, 8, 500), ...reasonLines].slice(0, 12),
    approvalRequired,
    affectedResources: sanitizeList(row.affectedResources, 8, 200),
    consequences: sanitizeList(row.consequences, 6, 500),
    reversible: reversibleOf(row.reversible, riskLevel),
    generatedArtifacts: refused ? [] : artifactList,
    commands: refused
      ? []
      : commandList.map((command) => ({
          ...command,
          approvalRequired: command.approvalRequired || riskLevel === "high",
        })),
    installationSteps: sanitizeList(row.installationSteps, 10, 500),
    validationSteps: sanitizeList(row.validationSteps, 10, 500),
    rollbackPlan: sanitizeList(row.rollbackPlan, 8, 500),
    warnings,
    finalResponse: sanitizeText(row.finalResponse, 8000) || summary,
    requirements: sanitizeList(row.requirements, 8, 300),
    envVars: envOf(row.envVars),
    disableSteps: sanitizeList(row.disableSteps, 8, 400),
    refused,
  };
  return applyQuality(result, options.targetOs ?? "any");
}
