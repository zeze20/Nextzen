import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/nextzen/confirm-dialog";
import { getAiStatus } from "@/lib/nextzen/generate.functions";
import { useHistory, useSettings } from "@/lib/nextzen/history";
import { useI18n } from "@/lib/nextzen/i18n";
import { downloadText } from "@/lib/nextzen/storage";
import type { AiStatus } from "@/lib/nextzen/types";

export const Route = createFileRoute("/ayarlar")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Nextzen — Ayarlar" }] }),
});

function SettingsPage() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { items, clear } = useHistory();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setStatusError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid max-w-2xl gap-8">
      <header>
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{t("settings.h1")}</h1>
      </header>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{t("settings.theme")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((theme) => (
            <label
              key={theme}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-sm"
            >
              <input
                type="radio"
                name="theme"
                checked={settings.theme === theme}
                onChange={() => update({ theme })}
              />
              {t(`settings.theme.${theme}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{t("settings.language")}</legend>
        <p className="text-sm text-muted">{t("settings.languageHint")}</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-sm">
            <input
              type="radio"
              name="language"
              checked={settings.language === "tr"}
              onChange={() => update({ language: "tr" })}
            />
            Türkçe
          </label>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-sm">
            <input
              type="radio"
              name="language"
              checked={settings.language === "en"}
              onChange={() => update({ language: "en" })}
            />
            English
          </label>
        </div>
      </fieldset>

      <section
        className="grid gap-2 border border-border bg-card p-4"
        aria-labelledby="provider-title"
      >
        <h2 id="provider-title" className="text-sm font-medium">
          {t("settings.provider")}
        </h2>
        {statusError ? (
          <p role="alert" className="text-sm text-danger">
            {t("err.network")}
          </p>
        ) : null}
        {!status && !statusError ? (
          <p className="text-sm text-muted">{t("common.loading")}</p>
        ) : null}
        {status ? (
          <>
            <p className="text-sm wrap-safe">
              {status.mode === "live" ? t("settings.providerLive") : t("settings.providerDemo")}
            </p>
            <p className="font-mono text-sm text-muted">
              {t("settings.model")}: {status.model ?? "demo"}
            </p>
          </>
        ) : null}
      </section>

      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={settings.safePreviewDefault}
          onChange={(event) => update({ safePreviewDefault: event.target.checked })}
        />
        <span>{t("settings.safeDefault")}</span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-border px-4 text-sm"
          onClick={() =>
            downloadText("nextzen-gecmis.json", JSON.stringify(items, null, 2), "application/json")
          }
        >
          {t("settings.export")}
        </button>
        <ConfirmDialog
          title={t("settings.clear")}
          body={t("settings.clearConfirm")}
          confirmLabel={t("settings.clearAction")}
          cancelLabel={t("history.cancel")}
          onConfirm={clear}
          trigger={
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-sm border border-danger px-4 text-sm text-danger"
            >
              {t("settings.clear")}
            </button>
          }
        />
      </div>

      <section className="grid gap-2" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="text-lg font-medium">
          {t("settings.privacyTitle")}
        </h2>
        <p className="text-sm text-muted">{t("settings.privacyBody")}</p>
      </section>
    </div>
  );
}
