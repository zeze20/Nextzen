import { detectCategory } from "./category.ts";
import { buildDemoResult } from "./demo.ts";
import { normalizeModelPayload } from "./normalize.ts";
import { extractJson, systemPrompt, userPrompt } from "./prompt.ts";
import { assessRisk } from "./risk.ts";
import { takeToken } from "./rate-limit.ts";
import { SCHEMA_VERSION } from "./types.ts";
import type {
  AiStatus,
  GenerateResponse,
  Lang,
  TaskInput,
  TaskRecord,
  TaskResult,
} from "./types.ts";

const DEFAULT_MODEL = "grok-4.5";
const WINDOW_MS = 60_000;

export interface GenerationDeps {
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  model?: string;
  rateKey?: string;
  now?: () => string;
}

function statusMessage(lang: Lang, codeName: string): string {
  const tr: Record<string, string> = {
    rate_limit: "Çok fazla istek. Bir dakika sonra yeniden deneyin.",
    provider: "Model yanıtı alınamadı. Görev kaydedilmedi.",
    invalid_output: "Model çıktısı doğrulanamadı. Görev kaydedilmedi.",
    timeout: "Model zaman aşımına uğradı. Görev kaydedilmedi.",
    unavailable: "Yapay zekâ bu ortamda yapılandırılmadı.",
  };
  const en: Record<string, string> = {
    rate_limit: "Too many requests. Try again in a minute.",
    provider: "The model response could not be retrieved. Nothing was saved.",
    invalid_output: "The model output could not be validated. Nothing was saved.",
    timeout: "The model timed out. Nothing was saved.",
    unavailable: "AI is not configured in this environment.",
  };
  const table = lang === "en" ? en : tr;
  return table[codeName] ?? table.provider;
}

export function readAiStatus(env: NodeJS.ProcessEnv = process.env): AiStatus {
  const apiKey = env.XAI_API_KEY?.trim();
  const model = env.XAI_MODEL?.trim() || DEFAULT_MODEL;
  if (!apiKey) return { mode: "demo", model: null };
  return { mode: "live", model };
}

function recordFrom(
  input: TaskInput,
  result: TaskResult,
  source: TaskRecord["source"],
  model: string | null,
  now: () => string,
): TaskRecord {
  const status = result.refused
    ? "refused"
    : result.approvalRequired
      ? "awaiting_approval"
      : "completed";
  return {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    categoryInput: input.category,
    category: detectCategory(
      `${input.title}\n${input.description}\n${input.projectContext}`,
      input.category,
    ),
    os: input.os,
    language: input.language,
    detailLevel: input.detailLevel,
    safePreview: input.safePreview,
    projectContext: input.projectContext,
    focus: input.focus,
    createdAt: now(),
    status,
    riskLevel: result.riskLevel,
    source,
    model,
    acknowledged: false,
    result,
  };
}

function tokenBudget(detail: TaskInput["detailLevel"]): number {
  if (detail === "brief") return 1200;
  if (detail === "detailed") return 3600;
  return 2200;
}

async function callModel(
  input: TaskInput,
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch,
  withFormat: boolean,
): Promise<
  | { ok: true; content: string }
  | { ok: false; code: "provider" | "timeout" | "rate_limit" | "invalid_output"; status?: number }
> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: tokenBudget(input.detailLevel),
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt(input) },
    ],
  };
  if (withFormat) body.response_format = { type: "json_object" };
  try {
    const response = await fetchImpl("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(40_000),
    });
    if (response.status === 429) return { ok: false, code: "rate_limit", status: 429 };
    if (!response.ok) return { ok: false, code: "provider", status: response.status };
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      return { ok: false, code: "invalid_output" };
    return { ok: true, content };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return { ok: false, code: "timeout" };
    if (error instanceof Error && error.name === "AbortError")
      return { ok: false, code: "timeout" };
    return { ok: false, code: "provider" };
  }
}

export async function runGeneration(
  input: TaskInput,
  deps: GenerationDeps = {},
): Promise<GenerateResponse> {
  const lang = input.languagePref;
  if (deps.rateKey) {
    const ipOk = takeToken(`ip:${deps.rateKey}`, 8, WINDOW_MS);
    if (!ipOk || !takeToken("global", 40, WINDOW_MS)) {
      return { ok: false, code: "rate_limit", message: statusMessage(lang, "rate_limit") };
    }
  }
  const floorText = `${input.title}\n${input.description}\n${input.projectContext}`;
  const floor = assessRisk(floorText);
  const now = deps.now ?? (() => new Date().toISOString());
  if (floor.malware) {
    const result = buildDemoResult(input);
    return {
      ok: true,
      record: recordFrom(
        input,
        { ...result, refused: true, commands: [], generatedArtifacts: [] },
        "policy",
        null,
        now,
      ),
    };
  }
  const apiKey = deps.apiKey === undefined ? process.env.XAI_API_KEY?.trim() || null : deps.apiKey;
  if (!apiKey) {
    const result = buildDemoResult(input);
    return { ok: true, record: recordFrom(input, result, "demo", null, now) };
  }
  const model = deps.model || process.env.XAI_MODEL?.trim() || DEFAULT_MODEL;
  const fetchImpl = deps.fetchImpl ?? fetch;
  let attempt = await callModel(input, apiKey, model, fetchImpl, true);
  if (!attempt.ok && attempt.code === "provider" && attempt.status === 400) {
    attempt = await callModel(input, apiKey, model, fetchImpl, false);
  }
  if (!attempt.ok && (attempt.status === 401 || attempt.status === 402 || attempt.status === 403)) {
    const result = buildDemoResult(input);
    const note =
      lang === "en"
        ? "The live model was unavailable because of credits or authorization. This sample is Demo Mode, not a model response."
        : "Canlı model kota veya yetki nedeniyle kullanılamadı. Bu örnek Demo Modudur, model yanıtı değildir.";
    result.warnings = [note, ...result.warnings];
    return { ok: true, record: recordFrom(input, result, "demo", null, now) };
  }
  if (!attempt.ok) {
    return { ok: false, code: attempt.code, message: statusMessage(lang, attempt.code) };
  }
  let content = attempt.content;
  let parsed: unknown;
  try {
    parsed = extractJson(content);
  } catch {
    const repair = await callModel(
      {
        ...input,
        description: `${input.description}\n\nReturn only the JSON object. Previous output was not valid JSON.`,
      },
      apiKey,
      model,
      fetchImpl,
      true,
    );
    if (!repair.ok) {
      return {
        ok: false,
        code: repair.code === "rate_limit" ? "rate_limit" : "invalid_output",
        message: statusMessage(lang, "invalid_output"),
      };
    }
    content = repair.content;
    try {
      parsed = extractJson(content);
    } catch {
      return { ok: false, code: "invalid_output", message: statusMessage(lang, "invalid_output") };
    }
  }
  const result = normalizeModelPayload(parsed, lang, floorText);
  return { ok: true, record: recordFrom(input, result, "live", model, now) };
}
