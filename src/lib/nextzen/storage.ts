import { SCHEMA_VERSION, type TaskRecord } from "./types.ts";

export const HISTORY_KEY = "nextzen.history.v1";
export const SETTINGS_KEY = "nextzen.settings.v1";
export const HISTORY_LIMIT = 80;

export interface Settings {
  theme: "light" | "dark" | "system";
  language: "tr" | "en";
  safePreviewDefault: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  language: "tr",
  safePreviewDefault: true,
};

function canStore(): boolean {
  return typeof window !== "undefined";
}

function readRaw(key: string): string | null {
  if (!canStore()) return null;
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  if (!canStore()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

function isRecord(value: unknown): value is TaskRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TaskRecord>;
  return (
    row.schemaVersion === SCHEMA_VERSION &&
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    !!row.result
  );
}

export function readHistory(): TaskRecord[] {
  const raw = readRaw(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function writeHistory(records: TaskRecord[]): boolean {
  return writeRaw(HISTORY_KEY, JSON.stringify(records.slice(0, HISTORY_LIMIT)));
}

export function readSettings(): Settings {
  const raw = readRaw(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme:
        parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system"
          ? parsed.theme
          : "system",
      language: parsed.language === "en" ? "en" : "tr",
      safePreviewDefault: parsed.safePreviewDefault !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Settings): boolean {
  return writeRaw(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyTheme(theme: Settings["theme"]): void {
  if (typeof document === "undefined") return;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
