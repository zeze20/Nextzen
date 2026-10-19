import type { TaskRecord } from "./types.ts";

export function slugify(input: string): string {
  const mapped = input
    .replace(/ç/gi, "c")
    .replace(/ğ/gi, "g")
    .replace(/ı/gi, "i")
    .replace(/İ/g, "i")
    .replace(/ö/gi, "o")
    .replace(/ş/gi, "s")
    .replace(/ü/gi, "u");
  const s = mapped
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "gorev";
}

export function exportBasename(record: TaskRecord): string {
  return `${slugify(record.title)}-${record.id.slice(0, 8)}`;
}

export function toJsonExport(record: TaskRecord): string {
  return JSON.stringify(record, null, 2);
}

export function toTextExport(record: TaskRecord): string {
  const r = record.result;
  const lines = [
    record.title,
    `${record.category} · ${record.riskLevel} · ${record.status}`,
    record.createdAt,
    "",
    r.summary,
    "",
    r.finalResponse,
    "",
    "Plan:",
    ...r.plan.map((step, i) => `${i + 1}. ${step}`),
    "",
    "Komutlar:",
    ...r.commands.map((c) => `# ${c.purpose} [${c.riskLevel}]\n${c.command}`),
  ];
  return lines.join("\n");
}

export function toMarkdownExport(record: TaskRecord): string {
  const r = record.result;
  const artifacts = r.generatedArtifacts
    .map((a) => `### ${a.filename}\n\n${a.purpose}\n\n\`\`\`${a.language}\n${a.content}\n\`\`\``)
    .join("\n\n");
  const commands = r.commands
    .map(
      (c) =>
        `### ${c.purpose}\n\n- OS: ${c.os}\n- Yetki: ${c.privilege}\n- Risk: ${c.riskLevel}\n- Etki: ${c.impact}\n- Geri alma: ${c.rollback}\n- Onay: ${c.approvalRequired ? "gerekli" : "gerekli değil"}\n\n\`\`\`\n${c.command}\n\`\`\``,
    )
    .join("\n\n");
  return [
    `# ${record.title}`,
    "",
    `> Kaynak: ${record.source}. Bu belge komutların çalıştırıldığını göstermez.`,
    "",
    `- Kategori: ${record.category}`,
    `- Risk: ${record.riskLevel}`,
    `- Durum: ${record.status}`,
    `- Tarih: ${record.createdAt}`,
    "",
    `## Özet`,
    "",
    r.summary,
    "",
    `## Yanıt`,
    "",
    r.finalResponse,
    "",
    `## Varsayımlar`,
    "",
    ...r.assumptions.map((a) => `- ${a}`),
    "",
    `## Plan`,
    "",
    ...r.plan.map((step, i) => `${i + 1}. ${step}`),
    "",
    `## Uyarılar`,
    "",
    ...r.warnings.map((w) => `- ${w}`),
    "",
    `## Komutlar`,
    "",
    commands || "_Komut yok._",
    "",
    `## Çıktılar`,
    "",
    artifacts || "_Dosya çıktısı yok._",
    "",
    `## Kurulum`,
    "",
    ...r.installationSteps.map((s) => `- ${s}`),
    "",
    `## Doğrulama`,
    "",
    ...r.validationSteps.map((s) => `- ${s}`),
    "",
    `## Geri alma`,
    "",
    ...r.rollbackPlan.map((s) => `- ${s}`),
  ].join("\n");
}
