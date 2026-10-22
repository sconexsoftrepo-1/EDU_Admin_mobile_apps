import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs/promises";
const slugs = [
  "little-sprouts",
  "sunrise-international",
  "maplewood-high",
  "evergreen-global",
];
const root = "artifacts/education-schools/screenshots";
const previews = "public/assets/education-schools/previews";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push({ url: page.url(), message: e.message }),
);
const checks = [];
async function ready() {
  await page
    .locator(".animation-content[aria-busy=false]")
    .waitFor({ timeout: 15000 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => i.loading !== "lazy")
        .map((i) => i.decode().catch(() => {})),
    );
  });
}
async function fullShot(path) {
  const { width, height: vh } = page.viewportSize();
  const height = await page.evaluate(() =>
    Math.ceil(document.documentElement.scrollHeight),
  );
  const hide = await page.addStyleTag({
    content:
      ".switch-trigger,.school-mobile-admit,.school-nav,.showroom-nav{visibility:hidden!important}",
  });
  const tiles = [];
  for (let y = 0; y < height; y += vh) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(100);
    const actual = await page.evaluate(() => scrollY),
      shot = await page.screenshot(),
      top = Math.max(0, Math.round(y - actual)),
      h = Math.min(vh - top, height - y);
    tiles.push({
      input: await sharp(shot)
        .extract({ left: 0, top, width, height: h })
        .png()
        .toBuffer(),
      left: 0,
      top: y,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#fff" } })
    .composite(tiles)
    .png()
    .toFile(path);
  await hide.evaluate((e) => e.remove());
  await page.evaluate(() => scrollTo(0, 0));
}
async function sectionShot(selector, path) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return;
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(selector.includes("world") ? 900 : 120);
  await page.screenshot({ path });
}
for (const slug of slugs) {
  for (const [view, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000/education-schools/" + slug);
    await ready();
    await page.screenshot({ path: `${root}/${slug}-${view}-hero.png` });
    await sharp(`${root}/${slug}-${view}-hero.png`)
      .webp({ quality: 86 })
      .toFile(`${previews}/${slug}-${view}.webp`);
    checks.push({
      slug,
      view,
      ...(await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        broken: [...document.images]
          .filter((i) => i.complete && !i.naturalWidth)
          .map((i) => i.src),
      }))),
    });
    // Warm lazy images and scenes through native page scrolling before stitching.
    for (
      let y = 0;
      y < (await page.evaluate(() => document.body.scrollHeight));
      y += height * 0.8
    ) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(70);
    }
    await fullShot(`${root}/${slug}-${view}-full.png`);
    for (const [label, selector] of [
      ["leadership", "#leadership"],
      ["academics", "#programs"],
      ["campus", ".school-world-campus"],
      ["learning", ".school-world-learning"],
      ["dashboard", ".school-dashboard"],
      ["faculty", ".school-faculty"],
      ["student-life", ".school-life"],
      ["admissions", ".school-admissions"],
      ["footer", ".school-footer"],
    ])
      await sectionShot(selector, `${root}/${slug}-${view}-${label}.png`);
    await page.goto(`http://localhost:3000/education-schools/${slug}/campus`);
    await ready();
    await page.locator(".school-world").first().scrollIntoViewIfNeeded();
    await page
      .locator(".school-world-stage canvas")
      .waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    await page
      .getByRole("group", { name: "campus features" })
      .getByRole("button")
      .nth(1)
      .click();
    await page.screenshot({ path: `${root}/${slug}-${view}-hotspot.png` });
    await page
      .getByRole("group", { name: "campus camera views" })
      .getByRole("button", { name: "Aerial", exact: true })
      .click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${root}/${slug}-${view}-aerial.png` });
    for (const route of [
      "leadership",
      "academics",
      "facilities",
      "faculty",
      "admissions",
      "contact",
    ]) {
      await page.goto(
        `http://localhost:3000/education-schools/${slug}/${route}`,
      );
      await ready();
      await fullShot(`${root}/${slug}-${view}-${route}-page.png`);
    }
    console.log("captured", slug, view);
  }
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(1200, 630, { fit: "cover", position: "top" })
    .webp({ quality: 86 })
    .toFile(`${previews}/${slug}-social.webp`);
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(640, 444)
    .webp({ quality: 84 })
    .toFile(`${previews}/${slug}-thumbnail.webp`);
  for (const width of [320, 375, 430, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://localhost:3000/education-schools/${slug}`);
    await ready();
    await page.screenshot({ path: `${root}/${slug}-width-${width}.png` });
  }
}
for (const [view, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://localhost:3000/education-schools");
  await ready();
  await page.screenshot({ path: `${root}/category-${view}-hero.png` });
  await fullShot(`${root}/category-${view}-full.png`);
}
await sharp(`${root}/category-desktop-hero.png`)
  .resize(1200, 630, { fit: "cover", position: "top" })
  .webp({ quality: 86 })
  .toFile(`${previews}/category-social.webp`);
await fs.writeFile(
  "artifacts/education-schools/visual-checks.json",
  JSON.stringify({ checks, errors }, null, 2),
);
await browser.close();
if (errors.length || checks.some((c) => c.overflow || c.broken.length))
  process.exitCode = 1;
