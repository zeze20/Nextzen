import { useNavigate } from "@tanstack/react-router";
import {
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { focusesFor } from "@/lib/nextzen/category";
import { generateTask } from "@/lib/nextzen/generate.functions";
import { useHistory, useSettings } from "@/lib/nextzen/history";
import { useI18n, type MessageKey } from "@/lib/nextzen/i18n";
import { parseTaskInput } from "@/lib/nextzen/schema";
import type { CategoryInput, DetailLevel, FieldErrors, Focus, OsTarget } from "@/lib/nextzen/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-11 w-full min-w-0 rounded-sm border border-border bg-card px-3 text-base text-foreground";

export function TaskForm({
  presetCategory = "auto",
  presetFocus = "auto",
  lockCategory = false,
}: {
  presetCategory?: CategoryInput;
  presetFocus?: Focus;
  lockCategory?: boolean;
}) {
  const { t, lang } = useI18n();
  const { settings } = useSettings();
  const history = useHistory();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryInput>(presetCategory);
  const [os, setOs] = useState<OsTarget>("any");
  const [language, setLanguage] = useState("");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [safePreview, setSafePreview] = useState(settings.safePreviewDefault);
  const [projectContext, setProjectContext] = useState("");
  const [focus, setFocus] = useState<Focus>(presetFocus);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [touchedSafe, setTouchedSafe] = useState(false);

  const safeValue = touchedSafe ? safePreview : settings.safePreviewDefault;
  const focuses = useMemo(() => focusesFor(category), [category]);
  const activeFocus = focuses.includes(focus) ? focus : "auto";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const candidate = {
      title,
      description,
      category,
      os,
      language,
      detailLevel,
      safePreview: safeValue,
      projectContext,
      focus: activeFocus,
      languagePref: lang,
    };
    const parsed = parseTaskInput(candidate);
    if (!parsed.ok) {
      setErrors(parsed.fields);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const response = await generateTask({ data: parsed.data });
      if (!response.ok) {
        if (response.fields) setErrors(response.fields);
        setServerError(response.message);
        return;
      }
      const saved = history.add(response.record);
      if (!saved) setServerError(t("err.network"));
      await navigate({ to: "/gecmis/$id", params: { id: response.record.id } });
    } catch {
      setServerError(t("err.network"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <Field
        label={t("form.title")}
        error={errors.title ? t("err.title") : undefined}
        htmlFor="task-title"
      >
        <input
          id="task-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={120}
          className={fieldClass}
          aria-invalid={errors.title ? true : undefined}
        />
      </Field>
      <Field
        label={t("form.description")}
        error={errors.description ? t("err.description") : undefined}
        htmlFor="task-description"
      >
        <textarea
          id="task-description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          minLength={10}
          maxLength={8000}
          rows={6}
          className={cn(fieldClass, "h-auto min-h-36 py-3")}
          aria-invalid={errors.description ? true : undefined}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("form.category")} htmlFor="task-category">
          <select
            id="task-category"
            name="category"
            value={category}
            disabled={lockCategory}
            onChange={(event) => setCategory(event.target.value as CategoryInput)}
            className={fieldClass}
          >
            {(["auto", "software", "automation", "sysadmin"] as const).map((item) => (
              <option key={item} value={item}>
                {t(`cat.${item}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.focus")} htmlFor="task-focus">
          <select
            id="task-focus"
            name="focus"
            value={activeFocus}
            onChange={(event) => setFocus(event.target.value as Focus)}
            className={fieldClass}
          >
            {focuses.map((item) => (
              <option key={item} value={item}>
                {t(`focus.${item}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("form.os")} htmlFor="task-os">
          <select
            id="task-os"
            name="os"
            value={os}
            onChange={(event) => setOs(event.target.value as OsTarget)}
            className={fieldClass}
          >
            {(["any", "linux", "windows", "macos"] as const).map((item) => (
              <option key={item} value={item}>
                {t(`os.${item}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("form.language")}
          htmlFor="task-language"
          error={errors.language ? t("err.language") : undefined}
        >
          <input
            id="task-language"
            name="language"
            value={language}
            maxLength={80}
            onChange={(event) => setLanguage(event.target.value)}
            className={fieldClass}
            aria-invalid={errors.language ? true : undefined}
          />
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t("form.detail")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["brief", "standard", "detailed"] as const).map((item) => (
            <label
              key={item}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-sm"
            >
              <input
                type="radio"
                name="detail"
                value={item}
                checked={detailLevel === item}
                onChange={() => setDetailLevel(item)}
              />
              {t(`detail.${item}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={safeValue}
          onChange={(event) => {
            setTouchedSafe(true);
            setSafePreview(event.target.checked);
          }}
        />
        <span>
          <span className="font-medium">{t("form.safe")}</span>
          <span className="mt-1 block text-muted">{t("form.safeHint")}</span>
        </span>
      </label>
      <Field
        label={`${t("form.context")} (${t("form.optional")})`}
        hint={t("form.contextHint")}
        error={errors.projectContext ? t("err.context") : undefined}
        htmlFor="task-context"
      >
        <textarea
          id="task-context"
          name="context"
          value={projectContext}
          maxLength={8000}
          rows={4}
          onChange={(event) => setProjectContext(event.target.value)}
          className={cn(fieldClass, "h-auto min-h-28 py-3")}
          aria-invalid={errors.projectContext ? true : undefined}
        />
      </Field>
      {serverError ? (
        <p
          role="alert"
          className="border border-danger/40 bg-card px-3 py-3 text-sm text-danger wrap-safe"
        >
          {serverError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-150 disabled:opacity-60 sm:w-fit"
        aria-busy={pending}
      >
        {pending ? t("form.pending") : t("form.submit")}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
