import { createServerFn } from "@tanstack/react-start";
import { parseTaskInput } from "./schema.ts";
import type { AiStatus, GenerateResponse } from "./types.ts";

function validationMessage(lang: "tr" | "en"): string {
  return lang === "en"
    ? "The form is invalid. Check the highlighted fields."
    : "Form geçersiz. İşaretli alanları kontrol edin.";
}

export const generateTask = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<GenerateResponse> => {
    const parsed = parseTaskInput(data);
    const lang = parsed.ok ? parsed.data.languagePref : "tr";
    if (!parsed.ok) {
      return {
        ok: false,
        code: "validation",
        message: validationMessage(lang),
        fields: parsed.fields,
      };
    }
    try {
      const { assertSameSiteRequest } = await import("../auth/isolation.server.ts");
      assertSameSiteRequest();
    } catch {
      return {
        ok: false,
        code: "provider",
        message: lang === "en" ? "The request was blocked." : "İstek engellendi.",
      };
    }
    let rateKey = "anon";
    try {
      const { getRequestIP } = await import("@tanstack/react-start/server");
      rateKey = getRequestIP({ xForwardedFor: true }) || "anon";
    } catch {
      rateKey = "anon";
    }
    const { runGeneration } = await import("./ai.server.ts");
    return runGeneration(parsed.data, { rateKey });
  });

export const getAiStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AiStatus> => {
    const { readAiStatus } = await import("./ai.server.ts");
    return readAiStatus();
  },
);
