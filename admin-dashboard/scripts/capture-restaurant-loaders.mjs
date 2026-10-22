import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs/promises";
const root = "artifacts/restaurants-food/loaders";
await fs.mkdir(root, { recursive: true });
const slugs = [
  "urban-bistro",
  "spice-route",
  "greenbowl-cafe",
  "ocean-grill",
  "royal-biryani-house",
  "biryani-express",
];
const durations = [3, 3.2, 2.8, 3.1, 3.6, 3.3];
const browser = await chromium.launch({ headless: true });
for (const [view, width, height] of [
  ["desktop", 1280, 900],
  ["mobile", 390, 844],
]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  for (const [index, slug] of slugs.entries()) {
    await page.goto("http://localhost:3000/restaurants-food/" + slug);
    await page.waitForFunction(
      () => window.__DENTAL_ANIMATION_QA__?.snapshot()?.mode === "initial",
    );
    for (const [stage, time] of [
      [0, 0.3],
      [1, durations[index] * 0.55],
      [2, durations[index] - 0.2],
    ]) {
      await page.evaluate((t) => window.__DENTAL_ANIMATION_QA__.seek(t), time);
      await page.screenshot({
        path: `${root}/${slug}-${view}-initial-${stage}.png`,
      });
      if (stage === 1)
        await sharp(`${root}/${slug}-${view}-initial-${stage}.png`)
          .webp({ quality: 84 })
          .toFile(
            `public/assets/restaurants-food/${slug}/animations/initial-${view}.webp`,
          );
    }
    await page.evaluate(() => window.__DENTAL_ANIMATION_QA__.skip());
    await page.locator(".animation-content[aria-busy=false]").waitFor();
    await page.reload();
    await page.waitForFunction(
      () => window.__DENTAL_ANIMATION_QA__?.snapshot()?.mode === "refresh",
    );
    await page.evaluate(() => window.__DENTAL_ANIMATION_QA__.seek(0.5));
    await page.screenshot({ path: `${root}/${slug}-${view}-refresh.png` });
    await sharp(`${root}/${slug}-${view}-refresh.png`)
      .webp({ quality: 84 })
      .toFile(
        `public/assets/restaurants-food/${slug}/animations/refresh-${view}.webp`,
      );
    await page.evaluate(() => window.__DENTAL_ANIMATION_QA__.skip());
    await page.locator(".animation-content[aria-busy=false]").waitFor();
    console.log(slug, view);
  }
  await context.close();
}
await browser.close();
