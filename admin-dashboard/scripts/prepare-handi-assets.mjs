import fs from "node:fs/promises";
import sharp from "sharp";
const spec = JSON.parse(
  await fs.readFile("artifacts/restaurants-food/handi-generation.json", "utf8"),
);
const root = "public/assets/restaurants-food/handi";
await fs.mkdir(root, { recursive: true });
for (const [name, original] of Object.entries(spec.sources)) {
  const retained = `artifacts/restaurants-food/source/handi-${name}.png`;
  try {
    await fs.access(retained);
  } catch {
    await fs.copyFile(original, retained);
  }
  const { width, height, hasAlpha } = await sharp(retained).metadata();
  if (!hasAlpha) throw Error(`${name} must have transparent alpha`);
  const png = await sharp(retained)
    .resize(1280, 1280, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();
  const aligned = await sharp({
    create: { width: 1280, height: 1450, channels: 4, background: "#00000000" },
  })
    .composite([{ input: png, left: 0, top: name === "lifted" ? 30 : 160 }])
    .png()
    .toBuffer();
  await sharp(aligned)
    .resize(960)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(`${root}/${name}.webp`);
  console.log(name, width, height, hasAlpha);
}
