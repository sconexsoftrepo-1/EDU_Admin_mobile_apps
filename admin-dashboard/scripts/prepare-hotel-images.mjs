import fs from "node:fs/promises";
import sharp from "sharp";
const spec = JSON.parse(await fs.readFile("/tmp/hotel-assets.json", "utf8"));
const manifest = [];
await fs.mkdir("public/assets/hotels-resorts/previews", { recursive: true });
for (const slug of Object.keys(spec.heroes)) {
  const base = `public/assets/hotels-resorts/${slug}`;
  for (const folder of [
    "hero",
    "rooms",
    "experiences",
    "gallery",
    "animations",
    "fallbacks",
    "models",
  ])
    await fs.mkdir(`${base}/${folder}`, { recursive: true });
  await fs.copyFile(
    spec.heroes[slug],
    `artifacts/hotels-resorts/source/${slug}-hero.png`,
  );
  await fs.copyFile(
    spec.boards[slug],
    `artifacts/hotels-resorts/source/${slug}-editorial.png`,
  );
  await sharp(spec.heroes[slug])
    .resize(1920, 1080, { fit: "cover" })
    .webp({ quality: 86 })
    .toFile(`${base}/hero/desktop.webp`);
  await sharp(spec.heroes[slug])
    .resize(900, 1200, {
      fit: "cover",
      position: slug === "luxury-hotel" ? "right" : "centre",
    })
    .webp({ quality: 84 })
    .toFile(`${base}/hero/mobile.webp`);
  const meta = await sharp(spec.boards[slug]).metadata();
  const w = Math.floor(meta.width / 3),
    h = Math.floor(meta.height / 2);
  for (let i = 0; i < 6; i++) {
    const file =
      i < 3
        ? `rooms/room-${i + 1}.webp`
        : `experiences/${["dining", "wellness", "adventure"][i - 3]}.webp`;
    await sharp(spec.boards[slug])
      .extract({
        left: (i % 3) * w,
        top: Math.floor(i / 3) * h,
        width: w,
        height: h,
      })
      .resize(1000, 750, { fit: "cover" })
      .webp({ quality: 87 })
      .toFile(`${base}/${file}`);
    manifest.push({
      slug,
      path: "/" + `${base}/${file}`.slice(7),
      source: `artifacts/hotels-resorts/source/${slug}-editorial.png`,
      method:
        "Built-in image generation; cell extracted from six-photo editorial sheet",
      sourceCell: i + 1,
    });
  }
  await sharp(spec.heroes[slug])
    .resize(1440, 1000, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-desktop.webp`);
  await sharp(spec.heroes[slug])
    .resize(390, 844, { fit: "cover" })
    .webp({ quality: 82 })
    .toFile(`public/assets/hotels-resorts/previews/${slug}-mobile.webp`);
  manifest.push({
    slug,
    path: `/assets/hotels-resorts/${slug}/hero/desktop.webp`,
    source: `artifacts/hotels-resorts/source/${slug}-hero.png`,
    method: "Built-in image generation; optimized landscape hero",
  });
  console.log(slug, meta.width, meta.height, "six cells");
}
await fs.writeFile(
  "artifacts/hotels-resorts/image-manifest.json",
  JSON.stringify(manifest, null, 2),
);
await fs.writeFile(
  "artifacts/hotels-resorts/generation-prompts.json",
  JSON.stringify(spec.prompts, null, 2),
);
