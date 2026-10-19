import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/nextzen/confirm-dialog";
import { ResultView } from "@/components/nextzen/result-view";
import { useHistory } from "@/lib/nextzen/history";
import { useI18n } from "@/lib/nextzen/i18n";

export const Route = createFileRoute("/gecmis/$id")({
  component: HistoryDetailPage,
  head: () => ({ meta: [{ title: "Nextzen — Kayıt" }] }),
});

function HistoryDetailPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const { ready, get, remove, acknowledge } = useHistory();
  const navigate = useNavigate();
  const record = get(id);

  if (!ready) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  if (!record) {
    return (
      <div className="grid max-w-xl gap-3">
        <h1 className="text-3xl font-medium">{t("history.missing")}</h1>
        <p className="text-muted">{t("history.missingBody")}</p>
        <Link
          to="/gecmis"
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium underline"
        >
          {t("nav.history")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/gecmis" className="text-sm text-muted underline">
          {t("nav.history")}
        </Link>
        <ConfirmDialog
          title={t("history.delete")}
          body={t("history.confirm")}
          confirmLabel={t("history.confirmAction")}
          cancelLabel={t("history.cancel")}
          onConfirm={() => {
            remove(record.id);
            void navigate({ to: "/gecmis" });
          }}
          trigger={
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-sm border border-border px-3 text-sm"
            >
              {t("history.delete")}
            </button>
          }
        />
      </div>
      <ResultView record={record} onAcknowledge={() => acknowledge(record.id)} />
    </div>
  );
}
