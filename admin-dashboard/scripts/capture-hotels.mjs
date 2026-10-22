import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs/promises";
const slugs = [
  "resort-paradise",
  "luxury-hotel",
  "mountain-retreat",
  "beach-resort",
];
const names = [
  "Solara Cove Resort",
  "The Aurelia Grand",
  "Northpine Retreat",
  "Azure Tide Villas",
];
const root = "artifacts/hotels-resorts/screenshots";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.addInitScript(() =>
  sessionStorage.setItem("cosmic-brand-visited", "1"),
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push({ url: page.url(), message: e.message }),
);
const report = [];
async function fullShot(path) {
  const { width, height: viewport } = page.viewportSize();
  const height = await page.evaluate(() =>
    Math.ceil(document.documentElement.scrollHeight),
  );
  const hide = await page.addStyleTag({
    content:
      ".switch-trigger,.hotel-mobile-book,.showroom-nav{visibility:hidden!important}",
  });
  const tiles = [];
  for (let y = 0; y < height; y += viewport) {
    await page.evaluate((y) => scrollTo(0, y), y);
    await page.waitForTimeout(160);
    const actual = await page.evaluate(() => scrollY);
    const shot = await page.screenshot();
    const top = Math.max(0, Math.round(y - actual)),
      tileHeight = Math.min(viewport - top, height - y);
    tiles.push({
      input: await sharp(shot)
        .extract({ left: 0, top, width, height: tileHeight })
        .png()
        .toBuffer(),
      left: 0,
      top: y,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: "#111" } })
    .composite(tiles)
    .png()
    .toFile(path);
  await hide.evaluate((e) => e.remove());
  await page.evaluate(() => scrollTo(0, 0));
}
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
for (const [index, slug] of slugs.entries()) {
  for (const [view, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`http://localhost:3000/hotels-resorts/${slug}`);
    await ready();
    await page.screenshot({ path: `${root}/${slug}-${view}-hero.png` });
    await sharp(`${root}/${slug}-${view}-hero.png`)
      .webp({ quality: 86 })
      .toFile(`public/assets/hotels-resorts/previews/${slug}-${view}.webp`);
    for (
      let y = 0;
      y < (await page.evaluate(() => document.body.scrollHeight));
      y += height * 0.8
    ) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(70);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(100);
    await fullShot(`${root}/${slug}-${view}-full.png`);
    await page.locator("#property").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${root}/${slug}-${view}-property.png` });
    for (const route of [
      "rooms",
      "dining",
      "wellness",
      "gallery",
      "booking",
      "offers",
      "contact",
    ]) {
      await page.goto(`http://localhost:3000/hotels-resorts/${slug}/${route}`);
      await ready();
      await fullShot(`${root}/${slug}-${view}-${route}.png`);
    }
    console.log("captured", slug, view);
  }
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(1200, 630, { fit: "cover", position: "top" })
    .webp({ quality: 86 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-social.webp`);
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(640, 444)
    .webp({ quality: 84 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-thumbnail.webp`);
  const desktop = await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(960, 667)
    .png()
    .toBuffer();
  const chrome = Buffer.from(
    `<svg width="1000" height="730"><rect x="0" y="0" width="1000" height="730" rx="18" fill="#1b1a24"/><circle cx="30" cy="20" r="4" fill="#b494a8"/><circle cx="45" cy="20" r="4" fill="#c3b185"/><circle cx="60" cy="20" r="4" fill="#8baf9d"/><text x="500" y="25" text-anchor="middle" fill="#ded6ec" font-size="13" font-family="Arial">${names[index]}</text></svg>`,
  );
  await sharp(chrome)
    .composite([{ input: desktop, left: 20, top: 43 }])
    .webp({ quality: 86 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-browser.webp`);
  const mobile = await sharp(`${root}/${slug}-mobile-hero.png`)
    .resize(351, 760)
    .png()
    .toBuffer();
  await sharp({
    create: { width: 391, height: 810, channels: 4, background: "#14141b" },
  })
    .composite([{ input: mobile, left: 20, top: 25 }])
    .webp({ quality: 86 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-device.webp`);
}
for (const [view, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://localhost:3000/hotels-resorts");
  await ready();
  await fullShot(`${root}/category-${view}.png`);
  await page.screenshot({ path: `${root}/category-${view}-hero.png` });
}
await sharp(`${root}/category-desktop-hero.png`)
  .resize(1200, 630, { fit: "cover", position: "top" })
  .webp({ quality: 86 })
  .toFile("public/assets/hotels-resorts/previews/category-social.webp");
for (const slug of slugs) {
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://localhost:3000/hotels-resorts/" + slug);
    await ready();
    const audit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      broken: [...document.images]
        .filter((i) => i.complete && !i.naturalWidth)
        .map((i) => i.src),
      h1: document.querySelector("h1")?.textContent,
    }));
    report.push({ slug, width, ...audit });
    await page.screenshot({ path: `${root}/${slug}-${width}.png` });
  }
}
await fs.writeFile(
  "artifacts/hotels-resorts/responsive-report.json",
  JSON.stringify({ report, errors }, null, 2),
);
console.log(
  "AUDIT",
  report.filter((r) => r.overflow || r.broken.length),
  errors,
);
await browser.close();
