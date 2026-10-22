import { chromium } from "playwright";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.DENTAL_QA_URL || "http://localhost:3000";
await mkdir(root + "artifacts/qa/screenshots", { recursive: true });
await mkdir(root + "public/assets/previews", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const runtimeErrors = [];
const report = [];
page.on("pageerror", (e) => runtimeErrors.push(e.message));
const selected = process.argv.slice(2);
for (const id of selected.includes("collection")
  ? []
  : selected.length
    ? selected
    : ["01", "02", "03", "04", "05", "06"]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(`${base}/templates/${id}`);
  if (!response?.ok())
    throw Error(`Template ${id} returned ${response?.status()}`);
  await page
    .locator(id === "01" ? ".hero" : ".experience main")
    .waitFor({ state: "visible" });
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => !document.querySelector(".exp-loader,.intro"),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(750);
  await sharp(await page.screenshot())
    .webp({ quality: 83 })
    .toFile(root + `public/assets/previews/${id}-desktop.webp`);
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  for (let y = 0; y < height; y += 750) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(70);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await sharp(await page.screenshot({ fullPage: true }))
    .webp({ quality: 76 })
    .toFile(root + `artifacts/qa/screenshots/${id}-desktop.webp`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  await sharp(await page.screenshot())
    .webp({ quality: 84 })
    .toFile(root + `public/assets/previews/${id}-mobile.webp`);
  const mobileHeight = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  for (let y = 0; y < mobileHeight; y += 700) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(800);
  await sharp(await page.screenshot({ fullPage: true }))
    .webp({ quality: 78 })
    .toFile(root + `artifacts/qa/screenshots/${id}-mobile.webp`);
  await copyFile(
    root + `public/assets/previews/${id}-desktop.webp`,
    root + `public/assets/previews/${id}-desktop-live.webp`,
  );
  await copyFile(
    root + `public/assets/previews/${id}-mobile.webp`,
    root + `public/assets/previews/${id}-mobile-live.webp`,
  );
  report.push({
    id,
    desktopHeight: height,
    mobileHeight,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  });
  console.log("Captured template", id);
}
await page.goto(base);
await page.setViewportSize({ width: 1440, height: 1000 });
for (const card of await page.locator(".collection-card").all()) {
  await card.scrollIntoViewIfNeeded();
}
await page.waitForFunction(() =>
  [...document.querySelectorAll(".collection-card img")].every(
    (img) => img.complete && img.naturalWidth > 0,
  ),
);
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(400);
await sharp(await page.screenshot({ fullPage: true }))
  .webp({ quality: 80 })
  .toFile(root + "artifacts/qa/screenshots/collection.webp");
let prior = [];
try {
  prior =
    JSON.parse(await readFile(root + "artifacts/qa/visual-report.json", "utf8"))
      .report || [];
} catch {}
const combined = new Map([...prior, ...report].map((row) => [row.id, row]));
await writeFile(
  root + "artifacts/qa/visual-report.json",
  JSON.stringify(
    {
      report: [...combined.values()].sort((a, b) => a.id.localeCompare(b.id)),
      runtimeErrors,
    },
    null,
    2,
  ),
);
await browser.close();
if (runtimeErrors.length) throw Error(JSON.stringify(runtimeErrors));
console.log("Visual captures complete, no runtime errors.");
