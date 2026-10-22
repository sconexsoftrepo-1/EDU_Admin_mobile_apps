import fs from "node:fs/promises";
import sharp from "sharp";
const slugs = [
  "little-sprouts",
  "sunrise-international",
  "maplewood-high",
  "evergreen-global",
];
const spec = {
  sources: Object.fromEntries(
    slugs.map((slug) => [
      slug,
      {
        hero: `artifacts/education-schools/source/${slug}-hero.png`,
        board: `artifacts/education-schools/source/${slug}-editorial.png`,
      },
    ]),
  ),
};
await fs.mkdir("public/assets/education-schools/previews", { recursive: true });
for (const [slug, source] of Object.entries(spec.sources)) {
  const base = `public/assets/education-schools/${slug}`;
  for (const dir of [
    "hero",
    "leadership",
    "facilities",
    "logos",
    "animations",
    "fallbacks",
  ])
    await fs.mkdir(`${base}/${dir}`, { recursive: true });
  await sharp(source.hero)
    .resize(1920, 1080, { fit: "cover" })
    .webp({ quality: 86 })
    .toFile(`${base}/hero/desktop.webp`);
  await sharp(source.hero)
    .resize(900, 1100, { fit: "cover", position: "right" })
    .webp({ quality: 84 })
    .toFile(`${base}/hero/mobile.webp`);
  const m = await sharp(source.board).metadata(),
    w = Math.floor(m.width / 4),
    h = Math.floor(m.height / 2);
  for (let i = 0; i < 8; i++) {
    const file =
      i < 4
        ? `leadership/person-${i + 1}.webp`
        : `facilities/${["classroom", "library", "sports", "lab"][i - 4]}.webp`;
    await sharp(source.board)
      .extract({
        left: (i % 4) * w + 3,
        top: Math.floor(i / 4) * h + 3,
        width: w - 6,
        height: h - 6,
      })
      .resize(i < 4 ? 600 : 800, i < 4 ? 800 : 600, {
        fit: "cover",
        position: i < 4 ? "top" : "centre",
      })
      .webp({ quality: 87 })
      .toFile(`${base}/${file}`);
  }
  const shapes =
    slug === "little-sprouts"
      ? '<path d="M32 53V29M32 35C8 39 7 12 13 12C29 12 34 24 32 35ZM32 29C32 13 47 10 55 14C57 26 46 37 32 29Z"/>'
      : slug === "sunrise-international"
        ? '<circle cx="32" cy="32" r="12"/><path d="M32 3V12M32 52V61M3 32H12M52 32H61M11 11L18 18M46 46L53 53M11 53L18 46M46 18L53 11"/>'
        : slug === "maplewood-high"
          ? '<path d="M9 10L32 3L55 10V33Q55 47 32 60Q9 47 9 33ZM19 20L32 16L45 20V39L32 44L19 39ZM32 16V44"/>'
          : '<circle cx="32" cy="32" r="27"/><ellipse cx="32" cy="32" rx="13" ry="27"/><path d="M7 23H57M7 41H57M17 56Q-1 25 13 13M47 56Q65 25 51 13"/>';
  const color =
    slug === "little-sprouts"
      ? "#cf3153"
      : slug === "evergreen-global"
        ? "#174f3e"
        : "#1554bd";
  await fs.writeFile(
    `${base}/logos/mark.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`,
  );
  console.log(slug, "prepared");
}
