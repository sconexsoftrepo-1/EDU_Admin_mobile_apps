import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const root = "public/assets/education-schools";
async function walk(dir) {
  return (
    await Promise.all(
      (await fs.readdir(dir, { withFileTypes: true })).map((d) =>
        d.isDirectory() ? walk(path.join(dir, d.name)) : path.join(dir, d.name),
      ),
    )
  ).flat();
}
const files = await walk(root),
  assets = [];
for (const file of files) {
  const bytes = (await fs.stat(file)).size,
    format = path.extname(file).slice(1).toUpperCase();
  let dimensions;
  try {
    const m = await sharp(file).metadata();
    dimensions = `${m.width}×${m.height}`;
  } catch {}
  const purpose = file.includes("/previews/")
    ? "Actual rendered website capture: category, collection, social or template switcher"
    : file.includes("/hero/")
      ? "Generated fictional campus illustration: responsive hero and static scene fallback"
      : file.includes("/leadership/")
        ? "Generated fictional adult portrait: leadership and faculty"
        : file.includes("/facilities/")
          ? "Generated fictional learning-space illustration: facilities and gallery"
          : file.includes("/models/")
            ? "Original procedural GLB: interactive campus, learning objects or globe"
            : file.includes("/logos/")
              ? "Original SVG mark: navigation and school identity"
              : "Actual captured loader frame: animation preview and QA";
  assets.push({
    path: "/" + file.replace(/^public\//, ""),
    format,
    bytes,
    dimensions,
    purpose,
    provenance:
      format === "GLB"
        ? "scripts/generate-school-models.mjs"
        : format === "SVG"
          ? "scripts/prepare-school-assets.mjs"
          : file.includes("/previews/") || file.includes("/animations/")
            ? "Playwright screenshot of implemented website"
            : "Built-in image generation; originals and exact prompts retained in artifacts/education-schools",
    status: "integrated",
  });
}
const totalBytes = assets.reduce((n, a) => n + a.bytes, 0);
await fs.writeFile(
  "artifacts/education-schools/asset-manifest.json",
  JSON.stringify({ total: assets.length, totalBytes, assets }, null, 2),
);
await fs.writeFile(
  "EDUCATION_ASSET_MANIFEST.md",
  `# Education & Schools asset manifest\n\n${assets.length} public assets · ${(totalBytes / 1048576).toFixed(2)} MiB total. Assets load per route and viewport, not as one download.\n\nGenerated image originals and exact generation prompts are in artifacts/education-schools/source and generation-prompts.json. These are fictional campuses and adults. GLBs are original stylized procedural geometry, with no remote textures or external dependencies. Website and loader previews are actual local browser captures.\n\n| Asset | Format / dimensions | Bytes | Integration |\n|---|---|---:|---|\n` +
    assets
      .map(
        (a) =>
          `| ${a.path} | ${a.format}${a.dimensions ? " / " + a.dimensions : ""} | ${a.bytes} | ${a.purpose} |`,
      )
      .join("\n") +
    "\n",
);
console.log(assets.length, "assets", totalBytes, "bytes");
