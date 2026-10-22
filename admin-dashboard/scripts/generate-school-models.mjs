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
  "little-sprouts",
  "sunrise-international",
  "maplewood-high",
  "evergreen-global",
];
for (const [index, slug] of slugs.entries()) {
  const dir = `public/assets/education-schools/${slug}/models`;
  await fs.mkdir(dir, { recursive: true });
  for (const kind of [
    "campus",
    "learning",
    ...(index === 3 ? ["globe"] : []),
  ]) {
    const scene = new T.Scene(),
      root = new T.Group();
    scene.add(root);
    const material = (color, metalness = 0) =>
      new T.MeshStandardMaterial({ color, roughness: 0.65, metalness });
    const cream = material(index === 0 ? "#ffde8c" : "#e9e0cb"),
      ink = material(["#e65d68", "#3e8dcb", "#315d7a", "#275a48"][index]),
      glass = material("#a8d6e6", 0.1),
      green = material("#6a9c67"),
      wood = material("#b28a5a"),
      white = material("#f4f4e9"),
      gold = material("#c6a25c", 0.5);
    function add(g, m, x, y, z, scale, id) {
      const mesh = new T.Mesh(g, m);
      mesh.position.set(x, y, z);
      if (scale) mesh.scale.set(...scale);
      if (id) mesh.userData.featureId = id;
      root.add(mesh);
      return mesh;
    }
    const box = (m, x, y, z, s, id) =>
      add(new T.BoxGeometry(1, 1, 1), m, x, y, z, s, id);
    const sphere = (m, x, y, z, s, id) =>
      add(new T.SphereGeometry(1, 20, 12), m, x, y, z, s, id);
    function tree(x, z) {
      add(new T.CylinderGeometry(0.06, 0.09, 0.6, 7), wood, x, 0.3, z);
      sphere(green, x, 0.95, z, [0.45, 0.65, 0.45]);
    }
    function block(x, z, w, h, depth, id) {
      box(cream, x, h / 2 + 0.15, z, [w, h, depth], id);
      box(ink, x, h + 0.2, z, [w + 0.14, 0.13, depth + 0.14], id);
      for (let y = 0.5; y < h; y += 0.48)
        for (let a = x - w / 2 + 0.22; a < x + w / 2 - 0.1; a += 0.4)
          box(glass, a, y, z + depth / 2 + 0.015, [0.23, 0.25, 0.025], id);
    }
    if (kind === "campus") {
      box(material("#c6d8b2"), 0, -0.05, 0, [7, 0.2, 5]);
      box(material("#e8dfc8"), 0, 0.065, 1, [0.65, 0.025, 3]);
      box(material("#bfc2b5"), 0, 0.09, 2.5, [7, 0.03, 0.28]);
      const ids =
        index === 0
          ? [
              "classrooms",
              "activity-room",
              "library-corner",
              "play-area",
              "outdoor-garden",
              "safety-zone",
            ]
          : index === 1
            ? [
                "primary-block",
                "junior-block",
                "library",
                "sports-ground",
                "computer-lab",
                "auditorium",
              ]
            : index === 2
              ? [
                  "academic-block",
                  "science-labs",
                  "library",
                  "sports-ground",
                  "computer-ai-lab",
                  "main-entrance",
                ]
              : [
                  "academic-block",
                  "research-labs",
                  "library",
                  "sports-complex",
                  "career-guidance-centre",
                  "auditorium",
                ];
      block(0, -0.5, 2, index === 0 ? 1 : 2.1, 1.1, ids[0]);
      block(-2, -0.2, 1.4, index === 0 ? 0.85 : 1.6, 1.4, ids[1]);
      block(2, -0.6, 1.4, index === 0 ? 1 : 1.8, 1.3, ids[2]);
      if (index === 1) {
        add(new T.CylinderGeometry(0.55, 0.65, 0.15, 28), white, 0, 0.2, 1.1);
        add(new T.CylinderGeometry(0.45, 0.45, 0.03, 28), glass, 0, 0.3, 1.1);
        add(new T.CylinderGeometry(0.03, 0.03, 0.7, 8), glass, 0, 0.6, 1.1);
        block(-2, -1.6, 1.4, 1.3, 0.7, ids[1]);
      }
      if (index === 2) {
        block(2, -1.5, 1.4, 2.4, 0.8, ids[1]);
        box(glass, 0, 1.3, 0.08, [1.8, 1.8, 0.04], ids[0]);
        for (let x = -0.7; x < 0.9; x += 0.35)
          box(material("#254562"), x, 2.32, -0.5, [0.25, 0.035, 0.8], ids[4]);
        add(
          new T.CylinderGeometry(0.45, 0.45, 0.12, 20),
          glass,
          2,
          2.65,
          -1.5,
          undefined,
          ids[1],
        );
      }
      if (index === 3) {
        add(
          new T.SphereGeometry(0.65, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          ink,
          0,
          2.3,
          -0.5,
        );
        for (let x = -0.7; x < 0.8; x += 0.45)
          add(
            new T.CylinderGeometry(0.07, 0.08, 0.8, 12),
            white,
            x,
            0.55,
            0.3,
            undefined,
            ids[0],
          );
        add(new T.ConeGeometry(0.2, 0.4, 16), gold, 0, 3.05, -0.5);
      }
      if (index === 0) {
        for (let i = 0; i < 2; i++) {
          const x = 1.2 + i * 0.6;
          add(
            new T.CylinderGeometry(0.15, 0.18, 0.45, 12),
            material(i ? "#e75d75" : "#468fc0"),
            x,
            0.4,
            1.5,
          );
          sphere(material("#f3b98e"), x, 0.85, 1.5, [0.23, 0.25, 0.23]);
          sphere(material("#4e3830"), x, 0.98, 1.47, [0.24, 0.13, 0.23]);
          box(wood, x, 0.13, 1.5, [0.15, 0.3, 0.15]);
        }
        box(material("#f09664"), -1.6, 0.28, 1.4, [1, 0.45, 0.7], ids[3]);
        const slide = box(
          material("#70bfd5"),
          -1.6,
          0.5,
          1.9,
          [0.45, 0.12, 1],
          ids[3],
        );
        slide.rotation.x = -0.5;
        sphere(gold, -2.8, 2.8, -1.5, [0.4, 0.4, 0.13]);
      } else {
        box(material("#72a465"), 1.6, 0.1, 1.6, [2, 0.04, 1.2], ids[3]);
        box(white, 1.6, 0.13, 1.6, [0.025, 0.01, 1.1]);
        box(white, 1.6, 0.13, 1.02, [1.9, 0.01, 0.025]);
        box(white, 1.6, 0.13, 2.18, [1.9, 0.01, 0.025]);
      }
      for (const [x, z] of [
        [-3, -1.8],
        [3, -1.8],
        [-3, 1.4],
        [3, 1.4],
        [-1, -2],
        [1, -2],
      ])
        tree(x, z);
      box(ink, -0.4, 0.5, 2.2, [0.08, 0.85, 0.08], ids[5]);
      box(gold, -0.4, 0.83, 2.2, [0.4, 0.25, 0.03], ids[5]);
    } else if (kind === "globe") {
      sphere(material("#5a9ab4"), 0, 1, 0, [1.6, 1.6, 1.6]);
      for (let i = 0; i < 6; i++) {
        const ring = add(
          new T.TorusGeometry(1.61, 0.009, 6, 64),
          gold,
          0,
          1,
          0,
        );
        ring.rotation.y = (i * Math.PI) / 6;
      }
      for (const y of [-0.7, 0, 0.7]) {
        const ring = add(
          new T.TorusGeometry(Math.sqrt(1.6 ** 2 - y * y), 0.009, 6, 64),
          gold,
          0,
          1 + y,
          0,
        );
        ring.rotation.x = Math.PI / 2;
      }
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399;
        const r = 1.6;
        const continent = sphere(
          green,
          Math.cos(a) * r * 0.8,
          1 + Math.sin(a) * 0.7,
          Math.sin(a) * r * 0.8,
          [0.55, 0.28, 0.24],
          ["dialogue", "languages", "community"][i % 3],
        );
        continent.rotation.y = -a;
      }
      add(new T.CylinderGeometry(0.8, 1, 0.15, 24), wood, 0, -0.85, 0);
    } else {
      box(wood, 0, -0.1, 0, [5, 0.2, 3.6]);
      if (index === 2) {
        box(ink, -0.2, 1.4, 0.2, [0.06, 0.7, 0.06], "physics");
        box(ink, -0.2, 1.8, 0.2, [1, 0.06, 0.06], "physics");
        for (let i = 0; i < 4; i++) {
          box(wood, -0.5 + i * 0.2, 1.55, 0.2, [0.015, 0.5, 0.015], "physics");
          sphere(
            gold,
            -0.5 + i * 0.2,
            1.25,
            0.2,
            [0.09, 0.09, 0.09],
            "physics",
          );
        }
      }
      if (index === 3) {
        box(wood, 0, 0.5, 0.9, [2.5, 0.1, 0.6], "research");
        box(white, 0, 0.65, 0.9, [0.9, 0.08, 0.4], "research");
        sphere(green, 0.4, 0.9, 0.8, [0.22, 0.22, 0.22], "research");
      }
      box(cream, 0, 0.8, -1.65, [5, 1.8, 0.12]);
      box(ink, 0, 1.1, -1.55, [1.8, 1, 0.05], "board");
      for (const x of [-1.4, 1.4]) {
        box(white, x, 0.6, 0.3, [1.3, 0.12, 1.5]);
        for (const z of [-0.2, 0.8]) box(wood, x, 0.27, z, [1, 0.55, 0.7]);
      }
      if (index === 0) {
        for (let i = 0; i < 3; i++)
          box(
            material(["#e96c7c", "#e9b741", "#60b0b5"][i]),
            -1.5 + i * 0.5,
            0.95,
            0.3,
            [0.45, 0.45, 0.45],
            "blocks",
          );
        box(ink, 1.3, 0.83, 0.3, [0.8, 0.1, 0.6], "books");
        sphere(gold, 1.4, 1.05, 0.2, [0.3, 0.3, 0.3], "puzzle");
      } else {
        box(ink, -1.2, 1.08, 0.1, [0.4, 0.45, 0.35], "robot");
        sphere(white, -1.2, 1.48, 0.1, [0.28, 0.25, 0.23], "robot");
        for (const x of [-1.3, -1.1])
          sphere(ink, x, 1.5, 0.31, [0.045, 0.05, 0.02], "robot");
        add(
          new T.CylinderGeometry(0.13, 0.2, 0.6, 16),
          glass,
          1.5,
          1.05,
          0.35,
          undefined,
          "experiment",
        );
        add(
          new T.ConeGeometry(0.25, 0.45, 18),
          glass,
          0.9,
          1,
          0.1,
          undefined,
          "experiment",
        );
        const microscope = box(
          ink,
          1.3,
          1.1,
          -0.5,
          [0.12, 0.65, 0.14],
          "microscope",
        );
        microscope.rotation.z = -0.4;
        box(ink, 1.3, 0.8, -0.5, [0.55, 0.08, 0.35], "microscope");
        sphere(gold, -1.2, 1.05, -0.7, [0.3, 0.3, 0.3], "globe");
      }
      box(wood, -2.2, 0.65, -0.8, [0.6, 1.3, 0.7], "books");
      for (let y = 0.25; y < 1.3; y += 0.3)
        box(gold, -2.2, y, -0.4, [0.5, 0.08, 0.04], "books");
    }
    const output = await new GLTFExporter().parseAsync(scene, { binary: true });
    await fs.writeFile(`${dir}/${kind}.glb`, Buffer.from(output));
    console.log(slug, kind, output.byteLength);
  }
}
