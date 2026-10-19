import { createFileRoute } from "@tanstack/react-router";
import { TaskForm } from "@/components/nextzen/task-form";
import { useI18n } from "@/lib/nextzen/i18n";

export const Route = createFileRoute("/gorev")({
  component: NewTaskPage,
  head: () => ({ meta: [{ title: "Nextzen — Yeni Görev" }] }),
});

function NewTaskPage() {
  const { t } = useI18n();
  return (
    <div className="grid gap-8">
      <header className="grid max-w-3xl gap-3">
        <h1 className="text-3xl font-medium tracking-tight md:text-4xl">{t("page.task.h1")}</h1>
        <p className="text-muted">{t("page.task.lead")}</p>
      </header>
      <TaskForm />
    </div>
  );
}
