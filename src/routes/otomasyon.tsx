import { createFileRoute } from "@tanstack/react-router";
import { TaskForm } from "@/components/nextzen/task-form";
import { useI18n } from "@/lib/nextzen/i18n";

export const Route = createFileRoute("/otomasyon")({
  component: AutomationPage,
  head: () => ({ meta: [{ title: "Nextzen — Otomasyon" }] }),
});

function AutomationPage() {
  const { t } = useI18n();
  return (
    <div className="grid gap-8">
      <header className="grid max-w-3xl gap-3">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
          {t("page.automation.h1")}
        </h1>
        <p className="text-muted">{t("page.automation.lead")}</p>
      </header>
      <ul className="flex flex-wrap gap-2 text-sm">
        {(["python", "bash", "powershell", "node", "gha"] as const).map((item) => (
          <li key={item} className="rounded-full border border-border px-3 py-2">
            {t(`focus.${item}`)}
          </li>
        ))}
      </ul>
      <TaskForm presetCategory="automation" lockCategory presetFocus="bash" />
    </div>
  );
}
