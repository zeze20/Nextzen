import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  readHistory,
  writeHistory,
  HISTORY_LIMIT,
  type Settings,
  readSettings,
  writeSettings,
  applyTheme,
  DEFAULT_SETTINGS,
} from "./storage.ts";
import { setLanguage } from "./i18n.ts";
import type { TaskRecord } from "./types.ts";

interface HistoryApi {
  ready: boolean;
  items: TaskRecord[];
  add: (record: TaskRecord) => boolean;
  remove: (id: string) => void;
  acknowledge: (id: string) => void;
  clear: () => void;
  get: (id: string) => TaskRecord | undefined;
}

const HistoryContext = createContext<HistoryApi | null>(null);

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TaskRecord[]>([]);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const stored = readHistory();
    setItems(stored);
    loaded.current = true;
    setReady(true);
  }, []);

  const api = useMemo<HistoryApi>(() => {
    const commit = (next: TaskRecord[]) => {
      const trimmed = next.slice(0, HISTORY_LIMIT);
      writeHistory(trimmed);
      setItems(trimmed);
      loaded.current = true;
      setReady(true);
      return true;
    };
    return {
      ready,
      items,
      get: (id) =>
        items.find((item) => item.id === id) ?? readHistory().find((item) => item.id === id),
      add: (record) => {
        const base = loaded.current ? items : readHistory();
        return commit([record, ...base.filter((item) => item.id !== record.id)]);
      },
      remove: (id) => {
        const base = loaded.current ? items : readHistory();
        commit(base.filter((item) => item.id !== id));
      },
      acknowledge: (id) => {
        const base = loaded.current ? items : readHistory();
        commit(
          base.map((item) =>
            item.id === id ? { ...item, acknowledged: true, status: "reviewed" as const } : item,
          ),
        );
      },
      clear: () => commit([]),
    };
  }, [items, ready]);

  return <HistoryContext.Provider value={api}>{children}</HistoryContext.Provider>;
}

export function useHistory(): HistoryApi {
  const value = useContext(HistoryContext);
  if (!value) throw new Error("HistoryProvider missing");
  return value;
}

interface SettingsApi {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const themeRef = useRef(settings.theme);
  themeRef.current = settings.theme;

  useEffect(() => {
    const stored = readSettings();
    setSettings(stored);
    applyTheme(stored.theme);
    setLanguage(stored.language);
    setReady(true);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themeRef.current === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const api = useMemo<SettingsApi>(
    () => ({
      settings,
      ready,
      update: (patch) => {
        setSettings((prev) => {
          const next = { ...prev, ...patch };
          writeSettings(next);
          applyTheme(next.theme);
          setLanguage(next.language);
          return next;
        });
      },
    }),
    [settings, ready],
  );

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("SettingsProvider missing");
  return value;
}
