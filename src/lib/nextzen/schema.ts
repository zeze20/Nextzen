import { z } from "zod";
import {
  CATEGORY_INPUTS,
  DETAIL_LEVELS,
  FOCUSES,
  LANGS,
  OS_TARGETS,
  type FieldErrors,
  type TaskInput,
} from "./types.ts";

export const taskInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(8000),
  category: z.enum(CATEGORY_INPUTS),
  os: z.enum(OS_TARGETS),
  language: z.string().trim().max(80),
  detailLevel: z.enum(DETAIL_LEVELS),
  safePreview: z.boolean(),
  projectContext: z.string().trim().max(8000),
  focus: z.enum(FOCUSES),
  languagePref: z.enum(LANGS),
});

export function parseTaskInput(
  input: unknown,
): { ok: true; data: TaskInput } | { ok: false; fields: FieldErrors } {
  const parsed = taskInputSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fields: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (
      key === "title" ||
      key === "description" ||
      key === "projectContext" ||
      key === "language"
    ) {
      if (!fields[key]) fields[key] = issue.code;
    }
  }
  if (!fields.title && !fields.description && !fields.projectContext && !fields.language) {
    fields.description = "invalid";
  }
  return { ok: false, fields };
}
