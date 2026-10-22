import { chromium } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs/promises";
const slugs = [
  "urban-bistro",
  "spice-route",
  "greenbowl-cafe",
  "ocean-grill",
  "royal-biryani-house",
  "biryani-express",
];
const root = "artifacts/restaurants-food/screenshots";
const previews = "public/assets/restaurants-food/previews";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ reducedMotion: "reduce" });
const errors = [];
const checks = [];
page.on("pageerror", (e) =>
  errors.push({ url: page.url(), message: e.message }),
);
async function ready() {
  await page
    .locator(".animation-content[aria-busy=false]")
    .waitFor({ timeout: 20000 });
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
      ".switch-trigger,.food-cart-trigger,.food-nav,.showroom-nav{visibility:hidden!important}",
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
for (const slug of slugs.filter(
  (s) =>
    !process.env.ONLY_SLUGS || process.env.ONLY_SLUGS.split(",").includes(s),
)) {
  for (const [view, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("http://localhost:3000/restaurants-food/" + slug);
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
    for (
      let y = 0;
      y < (await page.evaluate(() => document.body.scrollHeight));
      y += height * 0.85
    ) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(60);
    }
    await fullShot(`${root}/${slug}-${view}-full.png`);
    for (const [label, selector] of [
      ["owner", ".food-owner"],
      ["building", ".food-building"],
      ["chefs", ".food-chefs"],
      ["menu", ".food-menu"],
      ["qr", ".food-qr-dashboard"],
      ["reservation", ".food-reservation"],
      ["gallery", ".food-gallery"],
      ["footer", ".food-footer"],
    ])
      await sectionShot(selector, `${root}/${slug}-${view}-${label}.png`);
    for (const route of [
      "about",
      "menu",
      "our-chefs",
      "experiences",
      "qr",
      "contact",
    ]) {
      await page.goto(
        `http://localhost:3000/restaurants-food/${slug}/${route}`,
      );
      await ready();
      if (route === "experiences") {
        const world = page
          .locator(
            ".food-journey[data-active=true],.handi-journey[data-active=true]",
          )
          .first();
        await world.scrollIntoViewIfNeeded();
        if (await world.locator("canvas").count()) await expectReady(world);
      }
      await page.screenshot({
        path: `${root}/${slug}-${view}-${route}-page.png`,
      });
    }
    console.log("captured", slug, view);
  }
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(1200, 630, { fit: "cover", position: "top" })
    .webp({ quality: 85 })
    .toFile(`${previews}/${slug}-social.webp`);
  await sharp(`${root}/${slug}-desktop-hero.png`)
    .resize(640, 444)
    .webp({ quality: 84 })
    .toFile(`${previews}/${slug}-thumbnail.webp`);
}
for (const [view, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
]) {
  await page.setViewportSize({ width, height });
  await page.goto("http://localhost:3000/restaurants-food");
  await ready();
  await page.screenshot({ path: `${root}/category-${view}.png` });
}
await sharp(`${root}/category-desktop.png`)
  .resize(1200, 630, { fit: "cover", position: "top" })
  .webp({ quality: 85 })
  .toFile(`${previews}/category-social.webp`);
await fs.writeFile(
  "artifacts/restaurants-food/visual-checks.json",
  JSON.stringify({ checks, errors }, null, 2),
);
await browser.close();
if (errors.length || checks.some((c) => c.overflow || c.broken.length))
  process.exitCode = 1;
async function expectReady(world) {
  await world.locator("canvas").waitFor();
  await page.waitForTimeout(800);
}
