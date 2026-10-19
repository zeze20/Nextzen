import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RiskBadge } from "@/components/nextzen/result-view";
import { useHistory } from "@/lib/nextzen/history";
import { useI18n, type MessageKey } from "@/lib/nextzen/i18n";
import type { Category, RiskLevel } from "@/lib/nextzen/types";

export const Route = createFileRoute("/gecmis/")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "Nextzen — Geçmiş" }] }),
});

function HistoryPage() {
  const { t } = useI18n();
  const { ready, items } = useHistory();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [risk, setRisk] = useState<"all" | RiskLevel>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (risk !== "all" && item.riskLevel !== risk) return false;
      if (!q) return true;
      const blob = `${item.title} ${item.result.summary}`.toLocaleLowerCase("tr");
      return blob.includes(q);
    });
  }, [items, query, category, risk]);

  return (
    <div className="grid gap-6">
      <header className="grid gap-3">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{t("history.h1")}</h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{t("history.search")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full min-w-0 rounded-sm border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{t("history.filterCategory")}</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as "all" | Category)}
            className="h-11 rounded-sm border border-border bg-card px-3"
          >
            <option value="all">{t("history.all")}</option>
            <option value="software">{t("cat.software")}</option>
            <option value="automation">{t("cat.automation")}</option>
            <option value="sysadmin">{t("cat.sysadmin")}</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">{t("history.filterRisk")}</span>
          <select
            value={risk}
            onChange={(event) => setRisk(event.target.value as "all" | RiskLevel)}
            className="h-11 rounded-sm border border-border bg-card px-3"
          >
            <option value="all">{t("history.all")}</option>
            <option value="low">{t("risk.low")}</option>
            <option value="medium">{t("risk.medium")}</option>
            <option value="high">{t("risk.high")}</option>
          </select>
        </label>
      </div>
      {!ready ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
      {ready && filtered.length === 0 ? (
        <p className="text-sm text-muted">{t("history.empty")}</p>
      ) : null}
      <ul className="grid gap-2">
        {filtered.map((item) => (
          <li key={item.id}>
            <Link
              to="/gecmis/$id"
              params={{ id: item.id }}
              className="grid min-h-16 gap-3 border border-border bg-card px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <span className="min-w-0">
                <span className="block font-medium wrap-safe">{item.title}</span>
                <span className="mt-1 block text-sm text-muted wrap-safe">
                  {t(`cat.${item.category}` as MessageKey)} ·{" "}
                  {t(`status.${item.status}` as MessageKey)} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </span>
                <span className="mt-1 block text-sm text-muted wrap-safe">
                  {item.result.summary}
                </span>
              </span>
              <RiskBadge level={item.riskLevel} label={t(`risk.${item.riskLevel}` as MessageKey)} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
