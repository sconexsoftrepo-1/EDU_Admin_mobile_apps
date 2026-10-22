import * as T from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import fs from "node:fs/promises";
globalThis.FileReader = class {
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((v) => {
      this.result = `data:${b.type};base64,${Buffer.from(v).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const slugs = [
  "resort-paradise",
  "luxury-hotel",
  "mountain-retreat",
  "beach-resort",
];
for (const slug of slugs) {
  const scene = new T.Scene();
  const root = new T.Group();
  scene.add(root);
  const mat = (c, metal = 0) =>
    new T.MeshStandardMaterial({ color: c, roughness: 0.65, metalness: metal });
  const sand = mat("#c8b589"),
    wood = mat("#8c6746"),
    roof = mat("#443e30"),
    green = mat("#385e48"),
    glass = mat("#e9c98b", 0.3),
    stone = mat("#969a91");
  function mesh(g, m, x, y, z, scale) {
    const a = new T.Mesh(g, m);
    a.position.set(x, y, z);
    if (scale) a.scale.set(...scale);
    root.add(a);
    return a;
  }
  const box = (m, x, y, z, s) =>
    mesh(new T.BoxGeometry(1, 1, 1), m, x, y, z, s);
  function pine(x, z, s = 1) {
    mesh(new T.CylinderGeometry(0.045, 0.07, 0.5, 7), wood, x, 0.35, z);
    mesh(new T.ConeGeometry(0.4 * s, 1.4 * s, 8), green, x, 1 * s, z);
  }
  function palm(x, z) {
    mesh(new T.CylinderGeometry(0.05, 0.09, 1.3, 7), wood, x, 0.75, z);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const leaf = mesh(
        new T.SphereGeometry(1, 8, 5),
        green,
        x + Math.cos(a) * 0.3,
        1.5,
        z + Math.sin(a) * 0.3,
        [0.5, 0.045, 0.14],
      );
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.2;
    }
  }
  function cabin(x, z, s = 1) {
    box(wood, x, 0.55, z, [0.85 * s, 0.7 * s, 0.9 * s]);
    const r = mesh(
      new T.ConeGeometry(0.85 * s, 0.55 * s, 4),
      roof,
      x,
      1.1 * s,
      z,
    );
    r.rotation.y = Math.PI / 4;
    box(glass, x, 0.6, z + 0.46 * s, [0.52 * s, 0.4 * s, 0.02]);
    box(wood, x, 0.23, z + 0.6 * s, [1.1 * s, 0.1, 0.7 * s]);
  }
  if (slug === "luxury-hotel") {
    box(stone, 0, 0.08, 0, [5, 0.16, 3.4]);
    box(mat("#292b2d", 0.4), 0, 1.9, 0, [1.7, 3.6, 1.3]);
    box(mat("#62513b", 0.5), -1.5, 1.05, 0.1, [1.1, 1.9, 1.4]);
    box(mat("#62513b", 0.5), 1.5, 1.05, 0.1, [1.1, 1.9, 1.4]);
    for (let y = 0.45; y < 3.7; y += 0.3) {
      for (let x = -0.65; x < 0.8; x += 0.26)
        box(glass, x, y, 0.663, [0.13, 0.16, 0.025]);
      box(mat("#a99570", 0.6), 0, y + 0.1, 0, [1.8, 0.035, 1.45]);
    }
    box(mat("#3b9bb1", 0.2), 1.5, 2.04, 0.1, [0.8, 0.05, 0.8]);
    box(glass, 0, 0.5, 0.85, [0.9, 0.5, 0.4]);
  } else if (slug === "mountain-retreat") {
    mesh(new T.SphereGeometry(1, 30, 12), green, 0, -0.24, 0, [3, 0.45, 2.2]);
    for (let i = 0; i < 3; i++) {
      const a = mesh(
        new T.ConeGeometry(1.4, 2.5 + i * 0.35, 5),
        stone,
        -1.8 + i * 1.7,
        1.1,
        -1.2,
      );
      a.rotation.y = i * 0.5;
      mesh(
        new T.ConeGeometry(0.51, 0.8, 5),
        mat("#dce4e0"),
        -1.8 + i * 1.7,
        2 + i * 0.35,
        -1.2,
      );
    }
    cabin(-1, 0.5);
    cabin(0.7, 0.65, 0.85);
    for (let i = 0; i < 19; i++) {
      const a = i * 2.399;
      pine(
        Math.cos(a) * (1.5 + (i % 3) * 0.4),
        Math.sin(a) * 1.3,
        0.55 + (i % 4) * 0.12,
      );
    }
  } else {
    mesh(new T.SphereGeometry(1, 38, 14), sand, 0, -0.22, 0, [3, 0.36, 2.05]);
    mesh(
      new T.SphereGeometry(1, 32, 12),
      green,
      -0.5,
      -0.06,
      -0.35,
      [2.2, 0.15, 1.4],
    );
    box(mat("#27b9be", 0.15), 0, 0.12, 1, [1.6, 0.045, 0.65]);
    for (let i = 0; i < 4; i++) {
      cabin(-1.8 + i * 1.15, -0.35 + (i % 2) * 0.65, 0.75);
      palm(-2 + i * 1.3, -1);
    }
    if (slug === "beach-resort") {
      box(wood, 0, 0.12, 2, [4.2, 0.08, 0.18]);
      for (let i = 0; i < 3; i++) {
        cabin(-1.6 + i * 1.6, 2.5, 0.7);
        for (const dx of [-0.25, 0.25])
          box(wood, -1.6 + i * 1.6 + dx, -0.08, 2.5, [0.06, 0.5, 0.06]);
      }
    } else {
      box(wood, 2, 0.17, 0.7, [0.8, 0.15, 1]);
      palm(2, 0.7);
    }
  }
  const buffer = await new GLTFExporter().parseAsync(scene, { binary: true });
  const file = `public/assets/hotels-resorts/${slug}/models/property.glb`;
  await fs.writeFile(file, Buffer.from(buffer));
  console.log(slug, buffer.byteLength);
}
