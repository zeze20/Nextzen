import { createFileRoute } from "@tanstack/react-router";
import { TaskForm } from "@/components/nextzen/task-form";
import { useI18n } from "@/lib/nextzen/i18n";

export const Route = createFileRoute("/sistem")({
  component: SystemsPage,
  head: () => ({ meta: [{ title: "Nextzen — Sistem Yönetimi" }] }),
});

function SystemsPage() {
  const { t } = useI18n();
  return (
    <div className="grid gap-8">
      <header className="grid max-w-3xl gap-3">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{t("page.systems.h1")}</h1>
        <p className="text-muted">{t("page.systems.lead")}</p>
      </header>
      <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
        {(
          [
            "resources",
            "services",
            "disk",
            "network",
            "permissions",
            "logs",
            "docker",
            "backup",
          ] as const
        ).map((item) => (
          <li key={item} className="border-l border-border pl-3">
            {t(`focus.${item}`)}
          </li>
        ))}
      </ul>
      <TaskForm presetCategory="sysadmin" lockCategory presetFocus="disk" />
    </div>
  );
}
