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
  "urban-bistro",
  "spice-route",
  "greenbowl-cafe",
  "ocean-grill",
  "royal-biryani-house",
  "biryani-express",
];
let seed = 447;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
for (const [index, slug] of slugs.entries())
  for (const kind of ["food", "building"]) {
    const scene = new T.Scene(),
      root = new T.Group();
    scene.add(root);
    const mat = (c, metal = 0, rough = 0.55) =>
      new T.MeshStandardMaterial({
        color: c,
        metalness: metal,
        roughness: rough,
      });
    const copper = mat("#bd7447", 0.8, 0.28),
      gold = mat("#d5ac56", 0.72, 0.3),
      white = mat("#f6f0dd"),
      dark = mat("#24201d"),
      green = mat("#4c7939"),
      red = mat("#b53924"),
      wood = mat("#78503a");
    function mesh(
      geo,
      m,
      x = 0,
      y = 0,
      z = 0,
      scale = [1, 1, 1],
      parent = root,
      name = "",
    ) {
      const o = new T.Mesh(geo, m);
      o.position.set(x, y, z);
      o.scale.set(...scale);
      o.name = name;
      parent.add(o);
      return o;
    }
    const sphere = (m, x, y, z, s, parent = root, name = "") =>
      mesh(new T.SphereGeometry(1, 20, 12), m, x, y, z, s, parent, name);
    const box = (m, x, y, z, s, parent = root, name = "") =>
      mesh(new T.BoxGeometry(1, 1, 1), m, x, y, z, s, parent, name);
    function ring(radius, y, m, parent = root) {
      const o = mesh(
        new T.TorusGeometry(radius, 0.035, 8, 64),
        m,
        0,
        y,
        0,
        [1, 1, 1],
        parent,
      );
      o.rotation.x = Math.PI / 2;
      return o;
    }
    const group = (name) => {
      const g = new T.Group();
      g.name = name;
      root.add(g);
      return g;
    };
    function rice(parent, radius, y, count = 500) {
      for (const [c, portion] of [
        ["#f2e1ad", 0.65],
        ["#dfab44", 0.25],
        ["#d07428", 0.1],
      ]) {
        const n = Math.floor(count * portion),
          g = new T.SphereGeometry(1, 7, 5),
          im = new T.InstancedMesh(g, mat(c), n),
          dummy = new T.Object3D();
        im.name = "Rice grains";
        for (let k = 0; k < n; k++) {
          const a = random() * Math.PI * 2,
            r = Math.sqrt(random()) * radius;
          dummy.position.set(
            Math.cos(a) * r,
            y + 0.18 * (1 - r / radius) + random() * 0.07,
            Math.sin(a) * r,
          );
          dummy.rotation.set(random() * Math.PI, random() * 6, random() * 3);
          dummy.scale.set(0.018, 0.025, 0.065);
          dummy.updateMatrix();
          im.setMatrixAt(k, dummy.matrix);
        }
        parent.add(im);
      }
    }
    function leaf(x, y, z, size = 0.2, parent = root) {
      const l = sphere(
        green,
        x,
        y,
        z,
        [size, 0.025, size * 0.6],
        parent,
        "Herb leaf",
      );
      l.rotation.y = random() * 6;
    }
    function vessel(m, r = 1.2) {
      const points = [
        [0, 0.03],
        [0.5, 0.03],
        [0.85, 0.14],
        [1.05, 0.43],
        [1.16, 0.78],
        [1.2, 0.86],
      ].map(([x, y]) => new T.Vector2((x * r) / 1.2, y));
      mesh(
        new T.LatheGeometry(points, 64),
        m,
        0,
        0,
        0,
        [1, 1, 1],
        root,
        "Vessel",
      );
      ring(r, 0.86, gold);
      return r;
    }
    if (kind === "building") {
      const accent = mat(
          ["#6c3034", "#ae5734", "#62825b", "#327487", "#a67e3b", "#db3c24"][
            index
          ],
        ),
        wall = mat(index === 0 || index === 5 ? "#302825" : "#e2c8a2"),
        glass = mat("#81aab1", 0.15);
      box(mat("#a9a582"), 0, -0.06, 0, [6, 0.15, 4]);
      box(wall, 0, 1, 0, [3.8, 2, 2]);
      box(accent, 0, 2.05, 0, [4, 0.15, 2.2]);
      for (let x = -1.5; x <= 1.5; x += 0.6) {
        box(glass, x, 1.1, 1.02, [0.4, 1.35, 0.03]);
        box(gold, x, 1.9, 1.07, [0.08, 0.08, 0.08]);
      }
      box(wood, 0, 0.7, 1.05, [0.65, 1.4, 0.1]);
      for (let x = -2; x <= 2; x += 1.1) {
        box(wood, x, 0.4, 1.65, [0.55, 0.06, 0.45]);
        mesh(new T.CylinderGeometry(0.05, 0.05, 0.4, 10), wood, x, 0.2, 1.65);
        sphere(green, x, 0.9, -1.4, [0.4, 0.6, 0.4]);
        mesh(new T.CylinderGeometry(0.06, 0.09, 0.5, 8), wood, x, 0.25, -1.4);
      }
      if (index === 1 || index === 4) {
        for (let x = -1.6; x <= 1.6; x += 0.8) {
          mesh(
            new T.TorusGeometry(0.27, 0.07, 8, 24, Math.PI),
            gold,
            x,
            1.45,
            1.08,
          ).rotation.z = 0;
        }
        sphere(gold, 0, 2.15, 0, [0.65, 0.5, 0.6]);
      }
      if (index === 3) {
        box(mat("#3aa9ad", 0.2), 0, -0.02, 1.6, [6, 0.03, 1.1]);
      }
    } else {
      const base = group("Base"),
        protein = group("Protein"),
        vegetables = group("Vegetables"),
        spices = group("Spices"),
        lid = group("Lid");
      if (index === 0) {
        mesh(new T.CylinderGeometry(1.65, 1.5, 0.11, 64), white, 0, 0, 0);
        ring(1.5, 0.07, gold);
        rice(base, 1, 0.1, 450);
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1;
          sphere(
            mat("#cf9b63"),
            Math.cos(a) * 0.65,
            0.22,
            Math.sin(a) * 0.65,
            [0.25, 0.13, 0.25],
            protein,
          );
          leaf(Math.cos(a) * 0.9, 0.25, Math.sin(a) * 0.9, 0.2, vegetables);
        }
      } else if (index === 1) {
        vessel(copper);
        mesh(
          new T.CylinderGeometry(1.13, 1.1, 0.06, 48),
          mat("#c96d2d"),
          0,
          0.79,
          0,
          [1, 1, 1],
          base,
        );
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9;
          box(
            mat("#e5be72"),
            Math.cos(a) * 0.7,
            0.87,
            Math.sin(a) * 0.7,
            [0.27, 0.22, 0.25],
            protein,
          );
          leaf(Math.cos(a) * 0.7, 0.99, Math.sin(a) * 0.7, 0.16, vegetables);
        }
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05;
          const spice = sphere(
            k % 2 ? red : gold,
            Math.cos(a) * 1.6,
            1.1,
            Math.sin(a) * 1.6,
            [0.1, 0.07, 0.25],
            spices,
          );
          spice.name = "Spice-" + k;
        }
      } else if (index === 2) {
        vessel(white);
        rice(base, 1.08, 0.83, 350);
        for (let k = 0; k < 12; k++) {
          const a = k * 0.52;
          leaf(Math.cos(a) * 0.85, 0.94, Math.sin(a) * 0.85, 0.35, vegetables);
          sphere(
            red,
            Math.cos(a) * 0.55,
            1.02,
            Math.sin(a) * 0.55,
            [0.13, 0.13, 0.13],
            vegetables,
          );
          box(
            mat("#d9b978"),
            Math.cos(a) * 0.35,
            1.08,
            Math.sin(a) * 0.35,
            [0.17, 0.13, 0.15],
            protein,
          );
        }
        for (let k = 0; k < 4; k++) {
          const a = k * 1.57;
          sphere(
            mat("#a4ba4d"),
            Math.cos(a) * 0.7,
            1.14,
            Math.sin(a) * 0.7,
            [0.3, 0.07, 0.18],
            vegetables,
          );
        }
      } else if (index === 3) {
        mesh(
          new T.CylinderGeometry(1.7, 1.5, 0.12, 64),
          mat("#d9e9e7"),
          0,
          0,
          0,
        );
        ring(1.52, 0.08, mat("#267b8d"));
        for (let k = 0; k < 8; k++) {
          const a = k * 0.25;
          const tail = sphere(
            mat(k % 2 ? "#dd754e" : "#dc9b6a"),
            Math.sin(a) * 0.6,
            0.24 + Math.sin(k) * 0.02,
            Math.cos(a) * 0.5,
            [0.3, 0.18, 0.16],
            protein,
          );
          tail.rotation.y = -a;
        }
        for (let k = 0; k < 5; k++) {
          const a = k * 1.25;
          const shrimp = mesh(
            new T.TorusGeometry(0.2, 0.07, 8, 18, Math.PI * 1.4),
            mat("#e89b70"),
            Math.cos(a),
            0.22,
            Math.sin(a),
            [1, 1, 1],
            protein,
          );
          shrimp.rotation.x = Math.PI / 2;
          leaf(Math.cos(a) * 0.7, 0.23, Math.sin(a) * 0.7, 0.24, vegetables);
        }
        mesh(
          new T.CylinderGeometry(0.3, 0.3, 0.07, 24),
          mat("#e5ca51"),
          -1,
          0.15,
          0.65,
        );
      } else {
        vessel(index === 4 ? copper : dark);
        rice(base, 1.1, 0.83, 700);
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9,
            r = 0.65;
          sphere(
            mat(k % 2 ? "#b97032" : "#9c431c"),
            Math.cos(a) * r,
            1,
            Math.sin(a) * r,
            [0.25, 0.18, 0.23],
            protein,
          );
          leaf(Math.cos(a) * 0.75, 1.1, Math.sin(a) * 0.75, 0.16, vegetables);
        }
        if (index === 4) {
          const profile = [
            [0, 1.02],
            [0.25, 1.1],
            [0.8, 1.03],
            [1.22, 0.88],
          ].map(([x, y]) => new T.Vector2(x, y));
          mesh(
            new T.LatheGeometry(profile, 64),
            copper,
            0,
            0,
            0,
            [1, 1, 1],
            lid,
          );
          ring(1.22, 0.88, gold, lid);
          sphere(gold, 0, 1.17, 0, [0.13, 0.1, 0.13], lid);
          for (let k = 0; k < 24; k++) {
            const a = (k * Math.PI) / 12;
            const ornament = mesh(
              new T.TorusGeometry(0.08, 0.013, 5, 12),
              gold,
              Math.cos(a) * 1.1,
              0.52,
              Math.sin(a) * 1.1,
            );
            ornament.lookAt(0, 0.52, 0);
          }
          for (const x of [-1, 1]) {
            const handle = mesh(
              new T.TorusGeometry(0.22, 0.055, 8, 28),
              copper,
              x * 1.25,
              0.62,
              0,
            );
            handle.rotation.y = Math.PI / 2;
          }
        } else {
          lid.visible = false;
          const packaging = group("Packaging");
          box(mat("#b28a53"), 0, -0.15, 0, [3.1, 0.15, 2.4], packaging);
          box(red, 0, -0.04, -1.1, [3, 0.3, 0.1], packaging);
          packaging.scale.setScalar(0.001);
          for (let k = 0; k < 5; k++) {
            const a = k * 1.25;
            sphere(
              red,
              Math.cos(a) * 1.55,
              1.4,
              Math.sin(a) * 1.55,
              [0.07, 0.07, 0.35],
              spices,
            );
          }
        }
      }
      root.position.y = -0.45;
    }
    const output = await new GLTFExporter().parseAsync(scene, { binary: true });
    const dir = `public/assets/restaurants-food/${slug}/models`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(`${dir}/${kind}.glb`, Buffer.from(output));
    console.log(slug, kind, output.byteLength);
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
  }
