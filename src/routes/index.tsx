import { createFileRoute, Link } from "@tanstack/react-router";
import { useHistory } from "@/lib/nextzen/history";
import { useI18n, type MessageKey } from "@/lib/nextzen/i18n";
import { RiskBadge } from "@/components/nextzen/result-view";

export const Route = createFileRoute("/")({
  component: Overview,
  head: () => ({ meta: [{ title: "Nextzen — Genel Bakış" }] }),
});

function Overview() {
  const { t } = useI18n();
  const { ready, items } = useHistory();
  const recent = items.slice(0, 5);
  const high = items.filter((item) => item.status === "awaiting_approval").length;
  const count = (category: "software" | "automation" | "sysadmin") =>
    items.filter((item) => item.category === category).length;

  return (
    <div className="grid gap-12">
      <header className="grid max-w-3xl gap-5">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          {t("brand.kicker")}
        </p>
        <h1 className="text-4xl leading-[1.1] font-medium tracking-tight md:text-5xl">
          {t("overview.h1")}
        </h1>
        <p className="max-w-[62ch] text-base text-muted md:text-lg">{t("overview.lead")}</p>
        <Link
          to="/gorev"
          className="inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("overview.cta")}
        </Link>
      </header>

      <section className="grid gap-4" aria-labelledby="areas-title">
        <h2 id="areas-title" className="text-sm font-medium tracking-[0.14em] text-muted uppercase">
          {t("overview.areas")}
        </h2>
        <ol className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          <Area
            n="01"
            href="/yazilim"
            title={t("area.software.title")}
            body={t("area.software.body")}
          />
          <Area
            n="02"
            href="/otomasyon"
            title={t("area.automation.title")}
            body={t("area.automation.body")}
          />
          <Area
            n="03"
            href="/sistem"
            title={t("area.systems.title")}
            body={t("area.systems.body")}
          />
        </ol>
      </section>

      <section className="grid gap-4" aria-labelledby="stats-title">
        <h2 id="stats-title" className="text-sm font-medium tracking-[0.14em] text-muted uppercase">
          {t("overview.statsTitle")}
        </h2>
        {!ready ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
        {ready && items.length === 0 ? (
          <div className="border border-border bg-card px-4 py-6">
            <h3 className="text-lg font-medium">{t("overview.emptyTitle")}</h3>
            <p className="mt-2 max-w-[60ch] text-sm text-muted">{t("overview.emptyBody")}</p>
          </div>
        ) : null}
        {ready && items.length > 0 ? (
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-5">
            <Stat label={t("overview.statTotal")} value={items.length} />
            <Stat label={t("overview.statHigh")} value={high} />
            <Stat label={t("overview.statSoftware")} value={count("software")} />
            <Stat label={t("overview.statAutomation")} value={count("automation")} />
            <Stat label={t("overview.statSystems")} value={count("sysadmin")} />
          </dl>
        ) : null}
        <p className="text-sm text-muted">{t("overview.localNote")}</p>
      </section>

      <section className="grid gap-4" aria-labelledby="recent-title">
        <h2
          id="recent-title"
          className="text-sm font-medium tracking-[0.14em] text-muted uppercase"
        >
          {t("overview.recent")}
        </h2>
        {ready && recent.length === 0 ? (
          <p className="text-sm text-muted">{t("overview.emptyTitle")}</p>
        ) : null}
        {recent.length > 0 ? (
          <ul className="divide-y divide-border border border-border">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  to="/gecmis/$id"
                  params={{ id: item.id }}
                  className="grid min-h-16 gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <span className="min-w-0">
                    <span className="block font-medium wrap-safe">{item.title}</span>
                    <span className="text-sm text-muted">
                      {t(`cat.${item.category}` as MessageKey)} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <RiskBadge
                    level={item.riskLevel}
                    label={t(`risk.${item.riskLevel}` as MessageKey)}
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-4" aria-labelledby="principles-title">
        <h2
          id="principles-title"
          className="text-sm font-medium tracking-[0.14em] text-muted uppercase"
        >
          {t("overview.principles")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <li key={n} className="border-t border-border pt-3">
              <h3 className="font-medium">{t(`principle.${n}.title` as MessageKey)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`principle.${n}.body` as MessageKey)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Area({
  n,
  href,
  title,
  body,
}: {
  n: string;
  href: "/yazilim" | "/otomasyon" | "/sistem";
  title: string;
  body: string;
}) {
  return (
    <li className="bg-card">
      <Link to={href} className="grid min-h-36 gap-3 p-4">
        <span className="font-mono text-xs text-subtle">{n}</span>
        <span className="text-lg font-medium">{title}</span>
        <span className="text-sm text-muted">{body}</span>
      </Link>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-4 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-2 font-mono text-2xl tabular-nums">{value}</dd>
    </div>
  );
}
