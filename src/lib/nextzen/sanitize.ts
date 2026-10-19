function stripUnsafe(value: string): string {
  let text = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const bidi = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
    if (code === 0 || bidi) continue;
    text += char;
  }
  return text;
}

export function sanitizeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return stripUnsafe(value).replace(/\r\n/g, "\n").trim().slice(0, max);
}

export function sanitizeList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = sanitizeText(item, maxLen);
    if (!text) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function clampText(value: string, max: number): string {
  return sanitizeText(value, max);
}
