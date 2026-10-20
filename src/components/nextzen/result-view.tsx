import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { isLocked } from "@/lib/nextzen/approval";
import { gapText, lintSeverity, lintText } from "@/lib/nextzen/quality";
import { exportBasename, toJsonExport, toMarkdownExport, toTextExport } from "@/lib/nextzen/export";
import { useI18n, type MessageKey } from "@/lib/nextzen/i18n";
import { downloadText } from "@/lib/nextzen/storage";
import type { RiskLevel, TaskRecord, TaskStatus } from "@/lib/nextzen/types";
import { cn } from "@/lib/utils";

export function ResultView({
  record,
  onAcknowledge,
}: {
  record: TaskRecord;
  onAcknowledge: () => void;
}) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const result = record.result;
  const locked = isLocked(record);

  async function copyResult() {
    if (locked) return;
    const text = toTextExport(record);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  }

  function download(kind: "md" | "json" | "txt") {
    if (locked) return;
    const base = exportBasename(record);
    if (kind === "json") downloadText(`${base}.json`, toJsonExport(record), "application/json");
    if (kind === "md") downloadText(`${base}.md`, toMarkdownExport(record), "text/markdown");
    if (kind === "txt") downloadText(`${base}.txt`, toTextExport(record), "text/plain");
  }

  const sourceText =
    record.source === "demo"
      ? t("result.demo")
      : record.source === "policy"
        ? t("result.policy")
        : t("result.live");

  return (
    <article className="grid min-w-0 gap-8">
      <header className="grid gap-4">
        <p className="text-xs font-medium tracking-[0.16em] uppercase text-muted">
          {t("result.notExecuted")}
        </p>
        <h1 className="text-3xl leading-tight font-medium tracking-tight wrap-safe md:text-4xl">
          {record.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Meta label={t("result.category")} value={t(`cat.${record.category}` as MessageKey)} />
          <RiskBadge level={record.riskLevel} label={t(`risk.${record.riskLevel}` as MessageKey)} />
          <Meta
            label={t("status.completed")}
            value={t(`status.${record.status}` as MessageKey)}
            hideCaption
          />
        </div>
        <p className="border border-border bg-card px-3 py-3 text-sm wrap-safe" role="status">
          {sourceText}
          {record.model ? ` · ${record.model}` : ""}
        </p>
        {record.safePreview ? (
          <p className="text-sm text-muted">{t("result.safePreview")}</p>
        ) : null}
      </header>

      {result.approvalRequired ? (
        <section
          className="grid gap-3 border border-danger/50 bg-card p-4"
          aria-labelledby="risk-title"
        >
          <h2 id="risk-title" className="text-lg font-medium">
            {t("result.approvalTitle")}
          </h2>
          <p className="text-sm text-muted">{t("result.approvalBody")}</p>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-medium">{t("result.summary")}</dt>
              <dd className="wrap-safe text-muted">{result.summary}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("result.resources")}</dt>
              <dd className="text-muted">{result.affectedResources.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("result.consequences")}</dt>
              <dd className="text-muted">{result.consequences.join(" ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">{t("result.reversible")}</dt>
              <dd className="text-muted">{t(`result.rev.${result.reversible}` as MessageKey)}</dd>
            </div>
          </dl>
          {record.acknowledged ? (
            <p className="text-sm font-medium">{t("result.approved")}</p>
          ) : (
            <div className="grid gap-3">
              <label className="flex min-h-11 items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>{t("result.understood")}</span>
              </label>
              <button
                type="button"
                onClick={onAcknowledge}
                disabled={!understood}
                className="inline-flex min-h-11 items-center justify-center rounded-sm border border-foreground px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
              >
                {t("result.approve")}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {result.gaps?.length ? (
        <section
          className="grid gap-2 border border-warn/60 bg-card p-4"
          aria-labelledby="gaps-title"
        >
          <h2 id="gaps-title" className="text-lg font-medium">
            {t("result.gapsTitle")}
          </h2>
          <p className="text-sm text-muted">{t("result.gapsBody")}</p>
          <ul className="grid gap-2 text-sm">
            {result.gaps.map((gap) => (
              <li key={gap} className="border-l border-warn pl-3 wrap-safe">
                {gapText(gap, lang)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Section title={t("result.summary")}>
        <p className="wrap-safe">{result.summary}</p>
      </Section>
      <Section title={t("result.response")}>
        <p className="whitespace-pre-wrap wrap-safe">{result.finalResponse}</p>
      </Section>
      <ListSection title={t("result.assumptions")} items={result.assumptions} />
      <ListSection title={t("result.plan")} items={result.plan} ordered />
      <ListSection title={t("result.risks")} items={result.risks} />
      <ListSection title={t("result.warnings")} items={result.warnings} />

      {result.commands.length ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">{t("result.commands")}</h2>
          <ul className="grid gap-3">
            {result.commands.map((command, index) => (
              <li
                key={`${command.purpose}-${index}`}
                className="grid min-w-0 gap-3 border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-medium wrap-safe">{command.purpose}</h3>
                  <RiskBadge
                    level={command.riskLevel}
                    label={t(`risk.${command.riskLevel}` as MessageKey)}
                  />
                  <span className="text-xs text-muted">
                    {command.approvalRequired ? t("result.needsApproval") : t("result.noApproval")}
                  </span>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <Pair term={t("result.os")} value={command.os} />
                  <Pair term={t("result.privilege")} value={command.privilege} />
                  <Pair term={t("result.impact")} value={command.impact || "—"} />
                  <Pair term={t("result.commandRollback")} value={command.rollback || "—"} />
                </dl>
                <CodeBlock
                  language="shell"
                  code={command.command}
                  copyLabel={t("result.copyCode")}
                  copiedLabel={t("result.copied")}
                  locked={locked}
                  lockedLabel={t("result.copyLocked")}
                />
                <LintList codes={command.lint} />
                <p className="text-xs text-muted">{t("result.notExecuted")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.generatedArtifacts.length ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">{t("result.artifacts")}</h2>
          <ul className="grid gap-3">
            {result.generatedArtifacts.map((artifact) => (
              <li key={artifact.filename} className="grid min-w-0 gap-2">
                <p className="text-sm wrap-safe">
                  <span className="font-medium">{artifact.filename}</span>
                  {artifact.purpose ? (
                    <span className="text-muted"> — {artifact.purpose}</span>
                  ) : null}
                </p>
                <CodeBlock
                  language={artifact.language}
                  code={artifact.content}
                  copyLabel={t("result.copyCode")}
                  copiedLabel={t("result.copied")}
                  locked={locked}
                  lockedLabel={t("result.copyLocked")}
                />
                <LintList codes={artifact.lint} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ListSection title={t("result.requirements")} items={result.requirements} />
      {result.envVars.length ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">{t("result.env")}</h2>
          <ul className="grid gap-2">
            {result.envVars.map((item) => (
              <li
                key={item.name}
                className="border border-border bg-card px-3 py-3 text-sm wrap-safe"
              >
                <span className="font-mono">{item.name}</span>
                <span className="text-muted">
                  {" "}
                  · {item.required ? t("result.requiredEnv") : t("result.optionalEnv")}
                  {item.purpose ? ` — ${item.purpose}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ListSection title={t("result.install")} items={result.installationSteps} />
      <ListSection title={t("result.validation")} items={result.validationSteps} />
      <ListSection title={t("result.rollback")} items={result.rollbackPlan} />
      <ListSection title={t("result.disable")} items={result.disableSteps} />

      {locked ? (
        <p className="border border-border bg-card px-3 py-3 text-sm" role="status">
          {t("result.locked")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyResult}
          disabled={locked}
          className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? t("result.copied") : t("result.copy")}
        </button>
        <button
          type="button"
          onClick={() => download("md")}
          disabled={locked}
          className="min-h-11 rounded-sm border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("result.exportMd")}
        </button>
        <button
          type="button"
          onClick={() => download("json")}
          disabled={locked}
          className="min-h-11 rounded-sm border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("result.exportJson")}
        </button>
        <button
          type="button"
          onClick={() => download("txt")}
          disabled={locked}
          className="min-h-11 rounded-sm border border-border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("result.exportTxt")}
        </button>
      </div>
      <p className="sr-only" role="status">
        {copied ? t("result.copied") : ""}
      </p>
    </article>
  );
}

function LintList({ codes }: { codes?: string[] }) {
  const { t, lang } = useI18n();
  if (!codes?.length) return null;
  return (
    <div className="grid gap-1 text-sm">
      <p className="text-xs tracking-wide text-subtle uppercase">{t("result.checks")}</p>
      <ul className="grid gap-1">
        {codes.map((code) => {
          const severity = lintSeverity(code);
          return (
            <li
              key={code}
              className={cn(
                "border-l pl-3 wrap-safe",
                severity === "error" && "border-danger",
                severity === "warn" && "border-warn",
                severity === "info" && "border-border text-muted",
              )}
            >
              <span className="font-medium">{t(`result.lint.${severity}` as MessageKey)}: </span>
              {lintText(code, lang)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
        level === "high" && "border-danger text-danger",
        level === "medium" && "border-warn text-warn",
        level === "low" && "border-ok text-ok",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-[2px] border border-current",
          level === "high" && "bg-current",
          level === "medium" && "bg-current/50",
        )}
      />
      {label}
    </span>
  );
}

export function StatusText({ status }: { status: TaskStatus }) {
  const { t } = useI18n();
  return <span>{t(`status.${status}` as MessageKey)}</span>;
}

function Meta({
  label,
  value,
  hideCaption = false,
}: {
  label: string;
  value: string;
  hideCaption?: boolean;
}) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-border px-2.5 text-xs">
      {hideCaption ? value : `${label}: ${value}`}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="text-sm leading-6 md:text-base">{children}</div>
    </section>
  );
}

function ListSection({
  title,
  items,
  ordered = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  if (!items.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <List className={cn("grid gap-2 text-sm md:text-base", ordered && "list-decimal pl-5")}>
        {items.map((item, index) => (
          <li
            key={`${index}-${item.slice(0, 24)}`}
            className={cn("wrap-safe", !ordered && "border-l border-border pl-3")}
          >
            {item}
          </li>
        ))}
      </List>
    </section>
  );
}

function Pair({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-subtle uppercase">{term}</dt>
      <dd className="wrap-safe">{value}</dd>
    </div>
  );
}

export function CodeBlock({
  language,
  code,
  copyLabel,
  copiedLabel,
  locked = false,
  lockedLabel = "",
}: {
  language: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  locked?: boolean;
  lockedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="min-w-0 overflow-hidden rounded-sm border border-border bg-background">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs text-muted">
        <span className="font-mono uppercase">{language}</span>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 px-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={locked ? lockedLabel : copyLabel}
          disabled={locked}
          onClick={async () => {
            if (locked) return;
            try {
              await navigator.clipboard.writeText(code);
            } catch {
              const area = document.createElement("textarea");
              area.value = code;
              document.body.appendChild(area);
              area.select();
              document.execCommand("copy");
              area.remove();
            }
            setCopied(true);
          }}
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {locked ? lockedLabel : copied ? copiedLabel : copyLabel}
        </button>
      </figcaption>
      <pre className="max-w-full overflow-x-auto p-3 text-sm leading-6">
        <code className="font-mono">{code}</code>
      </pre>
      <span className="sr-only" role="status">
        {copied ? copiedLabel : ""}
      </span>
    </figure>
  );
}
