import { chromium } from "playwright";

const base = process.env.NEXTZEN_BASE_URL || "http://127.0.0.1:8080";
const widths = [320, 375, 768, 1280];
const paths = ["/", "/gorev", "/yazilim", "/otomasyon", "/sistem", "/gecmis", "/ayarlar"];

const highRiskRecord = {
  schemaVersion: 1,
  id: "view-high-1",
  title: "Yüksek riskli örnek kayıt",
  description: "sudo rm -rf /tmp/nextzen-ornek yalnızca risk göstergesidir.",
  categoryInput: "sysadmin",
  category: "sysadmin",
  os: "linux",
  language: "bash",
  detailLevel: "standard",
  safePreview: true,
  projectContext: "",
  focus: "disk",
  createdAt: "2026-01-02T00:00:00.000Z",
  status: "awaiting_approval",
  riskLevel: "high",
  source: "demo",
  model: null,
  acknowledged: false,
  result: {
    summary: "Silme önerisi çalıştırılmadı.",
    assumptions: ["Örnek kayıt."],
    plan: ["Önce yedek alın."],
    riskLevel: "high",
    risks: ["Dosya silme izi var."],
    approvalRequired: true,
    affectedResources: ["/tmp/nextzen-ornek"],
    consequences: ["Veri silinebilir."],
    reversible: "no",
    generatedArtifacts: [
      {
        language: "bash",
        filename: "ornek.sh",
        content: "#!/bin/sh\nprintf '%s\\n' 'calistirilmadi'\n",
        purpose: "Örnek",
      },
    ],
    commands: [
      {
        purpose: "Salt okunur kontrol",
        os: "linux",
        command: "df -h",
        privilege: "user",
        riskLevel: "low",
        impact: "Değişiklik yapmaz.",
        rollback: "Gerekmez.",
        approvalRequired: false,
      },
    ],
    installationSteps: ["Ek kurulum yok."],
    validationSteps: ["df çıktısını okuyun."],
    rollbackPlan: ["Yedek yoksa silmeyin."],
    warnings: ["DEMO MODU"],
    finalResponse: "Bu kayıt çalıştırılmadı.",
    requirements: ["Okuma yetkisi"],
    envVars: [],
    disableSteps: ["Kayıt silinebilir."],
    refused: false,
  },
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const failures = [];

await page.addInitScript((record) => {
  localStorage.setItem("nextzen.history.v1", JSON.stringify([record]));
}, highRiskRecord);

for (const width of widths) {
  await page.setViewportSize({ width, height: width < 700 ? 720 : 900 });
  for (const path of paths) {
    const response = await page.goto(base + path, { waitUntil: "networkidle" });
    if (!response || response.status() >= 400) {
      failures.push({ width, path, error: `status ${response?.status()}` });
      continue;
    }
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text: document.body.innerText.length,
    }));
    if (metrics.overflow > 1) failures.push({ width, path, overflow: metrics.overflow });
    if (metrics.text < 20) failures.push({ width, path, error: "empty" });
  }
}

await page.setViewportSize({ width: 320, height: 720 });
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Menüyü aç" }).click();
await page.getByRole("link", { name: "Yeni Görev" }).click();
await page.waitForURL("**/gorev");
await page.getByLabel("Görev başlığı").fill("ab");
await page.getByLabel("Görev açıklaması").fill("cok kisa");
await page.getByRole("button", { name: "Görevi hazırla" }).click();
const alert = page.getByRole("alert").first();
await alert.waitFor({ timeout: 5000 });

await page.goto(base + "/gecmis/view-high-1", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Yüksek risk — açık onay" }).waitFor();
await page.getByRole("button", { name: "Kodu kopyala" }).first().click();
const overflowDetail = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (overflowDetail > 1)
  failures.push({ width: 320, path: "/gecmis/view-high-1", overflow: overflowDetail });

await page.goto(base + "/ayarlar", { waitUntil: "networkidle" });
await page.getByRole("radio", { name: "Koyu" }).check();
const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
if (!dark) failures.push({ path: "/ayarlar", error: "dark theme class missing" });
await page.getByRole("radio", { name: "Açık" }).check();

await browser.close();

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, widths, paths: paths.length }));
