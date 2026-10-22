"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  useGLTF,
  useTexture,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshPhysicalMaterial,
  Plane,
  Vector3,
  CatmullRomCurve3,
  Shape,
  DoubleSide,
  type Material,
  type Points,
} from "three";
import {
  animationRegistry,
  type AnimationRun,
  type CameraPreset,
  type AnimationTemplateId,
} from "./config/animationRegistry";
import { useScenePerformance } from "./hooks/useScenePerformance";
function Model({
  run,
  preset,
  onReady,
}: {
  run: AnimationRun;
  preset: CameraPreset;
  onReady: () => void;
}) {
  const cfg = animationRegistry[run.templateId];
  const { scene } = useGLTF(
    preset.dpr === 1 ? cfg.assets.mobile : cfg.assets.desktop,
  );
  const root = useRef<Group>(null);
  const scanPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), -3), []);
  const clone = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      o.userData.basePosition = o.position.clone();
      o.userData.baseRotation = o.rotation.clone();
      if (o instanceof Mesh) {
        o.geometry = o.geometry.clone();
        const source = Array.isArray(o.material) ? o.material : [o.material];
        o.material = source.map((material) => {
          const m = material.clone() as MeshPhysicalMaterial;
          if (run.templateId === "06") {
            m.clippingPlanes = [scanPlane];
            m.transparent = true;
            m.depthWrite = false;
          }
          return m;
        });
        if (o.material.length === 1) o.material = o.material[0];
        o.userData.basePosition = o.position.clone();
        o.userData.baseRotation = o.rotation.clone();
      }
    });
    return copy;
  }, [scene, run.templateId, scanPlane]);
  useEffect(() => {
    onReady();
    return () => {
      clone.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
    };
  }, [clone, onReady]);
  const wire = useMemo(() => {
    if (run.templateId !== "06") return null;
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof Mesh) {
        o.material = new MeshPhysicalMaterial({
          color: cfg.theme.primary,
          wireframe: true,
          transparent: true,
          opacity: 0.32,
          emissive: cfg.theme.primary,
          emissiveIntensity: 0.4,
          depthWrite: false,
        });
        o.geometry = o.geometry.clone();
        o.userData.wire = true;
      }
    });
    return copy;
  }, [scene, run.templateId, cfg.theme.primary]);
  useEffect(
    () => () => {
      wire?.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as Material).dispose();
        }
      });
    },
    [wire],
  );
  useFrame(() => {
    if (!root.current) return;
    const c = run.clock,
      t = c.time;
    const isInitial = run.mode === "initial";
    const f = isInitial ? Math.max(0, Math.min(1, c.formation)) : 1;
    if (
      isInitial &&
      (run.templateId === "03" ||
        run.templateId === "04" ||
        run.templateId === "05")
    )
      clone.visible = f > 0.005;
    root.current.scale.setScalar(
      preset.modelScale *
        (run.mode === "switch" ? 0.75 : 1) *
        (1 - c.exit * 0.23),
    );
    root.current.rotation.y =
      c.rotation +
      (run.templateId === "02" ? 0.16 : run.templateId === "04" ? -0.12 : 0) +
      ((c as typeof c & { pointerX?: number }).pointerX || 0) * 0.09;
    root.current.rotation.x =
      0.07 + ((c as typeof c & { pointerY?: number }).pointerY || 0) * 0.035;
    root.current.position.y =
      run.templateId === "03" && isInitial
        ? (1 - f) * 1.7
        : run.templateId === "04" && isInitial
          ? -(1 - f) * 0.5
          : 0;
    clone.traverse((o) => {
      const pos = o.userData.basePosition as Vector3 | undefined;
      if (!pos) return;
      if (o.name.startsWith("fragment_")) {
        const n = Number(o.name.split("_")[1]);
        o.position.copy(pos);
        o.position.x += (1 - f) * (n % 2 ? 1 : -1) * (1.1 + n * 0.08);
        o.position.y += (1 - f) * (n < 2 ? 1.2 : n < 4 ? 0.3 : -1.3);
        o.position.z += (1 - f) * (n % 2 ? 0.5 : -0.5);
      } else if (run.templateId === "02") {
        o.position.copy(pos);
        if (o.name === "crown") o.position.y += (1 - f) * 1.35;
        if (o.name === "abutment") o.position.x += (1 - f) * 0.7;
        if (o.name === "fixture") o.position.y -= (1 - f) * 0.85;
      }
      if (o.name === "ribbon" && o instanceof Mesh) {
        const m = o.material as MeshPhysicalMaterial;
        m.transparent = true;
        m.opacity = isInitial ? Math.min(1, f * 1.4) : 1;
        const count =
          o.geometry.index?.count || o.geometry.attributes.position.count;
        o.geometry.setDrawRange(
          0,
          Math.floor((count * (isInitial ? f : Math.min(1, t / 0.6))) / 3) * 3,
        );
        o.rotation.y = (1 - f) * -0.8 + Math.sin(t * 2) * 0.025;
      }
      if (o instanceof Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((raw) => {
          const m = raw as MeshPhysicalMaterial;
          if (run.templateId === "01") {
            m.transparent = true;
            m.opacity = (0.26 + f * 0.6) * (1 - c.exit * 0.7);
          }
          if (run.templateId === "06") {
            m.opacity = o.name.startsWith("pulp") ? 0.7 : 0.08 + c.scan * 0.32;
            m.wireframe = false;
          }
        });
      }
    });
    const arm = clone.getObjectByName("wave_arm");
    if (arm) {
      const wave = run.mode === "initial" ? Math.max(0, t - 0.65) : t;
      arm.rotation.z =
        -0.2 -
        Math.sin(Math.min(1, wave / 0.7) * Math.PI * 3) *
          0.45 *
          (wave < 0.95 ? 1 : 0);
      arm.rotation.x = 0.15;
    }
    if (wire) {
      wire.rotation.copy(clone.rotation);
      wire.visible = c.scan < 0.95;
      wire.traverse((o) => {
        if (o instanceof Mesh) {
          (o.material as MeshPhysicalMaterial).opacity =
            0.45 * (1 - c.scan * 0.8);
          const count =
            o.geometry.index?.count || o.geometry.attributes.position.count;
          const progress = isInitial ? f : Math.min(1, t / 0.5);
          o.geometry.setDrawRange(0, Math.floor((count * progress) / 3) * 3);
        }
      });
    }
    scanPlane.constant = isInitial ? -2 + 4.1 * Math.max(f, c.scan) : 2.2;
  });
  return (
    <group ref={root}>
      <primitive object={clone} dispose={null} />
      {wire && <primitive object={wire} dispose={null} />}
    </group>
  );
}
function Rings({ run, preset }: { run: AnimationRun; preset: CameraPreset }) {
  const root = useRef<Group>(null);
  const cfg = animationRegistry[run.templateId];
  useFrame(() => {
    if (!root.current) return;
    const c = run.clock;
    root.current.rotation.y = c.time * 0.16;
    root.current.scale.setScalar((0.65 + c.ambient * 0.35) * (1 + c.exit * 3));
    root.current.children.forEach((o, i) => {
      o.rotation.z = (i % 2 ? 1 : -1) * c.time * 0.15;
      const m = (o as Mesh).material as MeshPhysicalMaterial;
      m.opacity = (0.12 + c.ambient * 0.55) * (1 - c.exit);
    });
  });
  return (
    <group ref={root}>
      {Array.from({ length: run.templateId === "03" ? 2 : 3 }, (_, i) => (
        <mesh
          key={i}
          rotation={[1.12 + i * 0.17, 0.15, i * 0.7]}
          position={[0, 0.08, 0]}
        >
          <torusGeometry
            args={[
              preset.orbitSize + i * 0.13,
              run.templateId === "04" ? 0.009 : 0.013,
              6,
              preset.particleCount < 30 ? 80 : 120,
            ]}
          />
          <meshBasicMaterial
            color={i === 1 ? cfg.theme.secondary : cfg.theme.primary}
            transparent
            opacity={0}
            blending={
              run.templateId === "03" || run.templateId === "05"
                ? undefined
                : AdditiveBlending
            }
          />
        </mesh>
      ))}
    </group>
  );
}
function Particles({
  run,
  preset,
}: {
  run: AnimationRun;
  preset: CameraPreset;
}) {
  const ref = useRef<Points>(null);
  const cfg = animationRegistry[run.templateId];
  const sprite = useTexture(cfg.assets.sprite);
  const { geometry, seeds } = useMemo(() => {
    const seeds = Array.from({ length: preset.particleCount }, (_, i) => ({
      angle: i * 2.39996,
      radius: 1.4 + (i % 11) * 0.17,
      height: ((i * 17) % 37) / 9 - 2,
      speed: 0.07 + (i % 5) * 0.015,
    }));
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(seeds.length * 3), 3),
    );
    return { geometry, seeds };
  }, [preset.particleCount]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (!ref.current) return;
    const c = run.clock;
    const p = geometry.attributes.position;
    seeds.forEach((s, i) => {
      const a = s.angle + c.time * s.speed,
        r = s.radius * (1.28 - c.ambient * 0.28 + c.exit * 0.6);
      p.setXYZ(
        i,
        Math.cos(a) * r,
        s.height + Math.sin(c.time * 0.7 + i) * 0.09,
        Math.sin(a) * r * 0.7,
      );
    });
    p.needsUpdate = true;
    ref.current.rotation.y = c.time * 0.03;
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        map={sprite}
        color={cfg.theme.primary}
        size={preset.particleCount < 30 ? 0.085 : 0.07}
        transparent
        opacity={0.7}
        depthWrite={false}
        blending={AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
function Outline({ run }: { run: AnimationRun }) {
  const cfg = animationRegistry[run.templateId];
  const line = useMemo(() => {
    const points = [
      [0, 0.9],
      [0.6, 1.15],
      [0.9, 0.6],
      [0.65, -0.12],
      [0.46, -1.2],
      [0.25, -1.27],
      [0.14, -0.45],
      [-0.14, -0.45],
      [-0.25, -1.27],
      [-0.46, -1.2],
      [-0.65, -0.12],
      [-0.9, 0.6],
      [-0.6, 1.15],
      [0, 0.9],
    ].map(([x, y]) => new Vector3(x, y, 0.5));
    const curve = new CatmullRomCurve3(points);
    return new Line(
      new BufferGeometry().setFromPoints(curve.getPoints(180)),
      new LineBasicMaterial({
        color: cfg.theme.primary,
        transparent: true,
        opacity: 0.8,
      }),
    );
  }, [cfg.theme.primary]);
  useEffect(
    () => () => {
      line.geometry.dispose();
      line.material.dispose();
    },
    [line],
  );
  useFrame(() => {
    const t = run.clock.time;
    line.visible = run.templateId === "04" || run.templateId === "06";
    line.geometry.setDrawRange(
      0,
      Math.floor(181 * Math.min(1, t / (run.mode === "initial" ? 0.5 : 0.35))),
    );
    line.material.opacity =
      run.mode === "initial"
        ? Math.max(0, 1 - (t - 0.4) * 1.8)
        : Math.max(0, 1 - t / 0.9);
    line.scale.setScalar(run.mode === "refresh" ? 1.15 : 1.4);
  });
  return <primitive object={line} />;
}
function MascotDecor({ run }: { run: AnimationRun }) {
  const cfg = animationRegistry[run.templateId];
  const root = useRef<Group>(null);
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 0.1);
    s.bezierCurveTo(-0.35, 0.5, -0.65, 0.1, 0, -0.45);
    s.bezierCurveTo(0.65, 0.1, 0.35, 0.5, 0, 0.1);
    return s;
  }, []);
  useFrame(() => {
    if (!root.current) return;
    root.current.children.forEach((o, i) => {
      o.position.y =
        Math.sin(run.clock.time * 0.7 + i) * 0.15 + (i % 2 ? 0.8 : -0.5);
      o.rotation.z = Math.sin(run.clock.time * 0.6 + i) * 0.15;
      const scale = (0.4 + run.clock.ambient * 0.6) * (1 - run.clock.exit);
      o.scale.setScalar(scale);
    });
  });
  return (
    <group ref={root}>
      {[-1, 1].map((side, i) => (
        <group key={side} position={[side * 1.85, 0, -0.2]}>
          <mesh rotation={[0, side * 0.3, 0]}>
            <extrudeGeometry
              args={[
                shape,
                {
                  depth: 0.08,
                  bevelEnabled: true,
                  bevelSize: 0.03,
                  bevelThickness: 0.03,
                  bevelSegments: 2,
                  steps: 1,
                },
              ]}
            />
            <meshStandardMaterial
              color={i ? cfg.theme.secondary : "#8dd6f3"}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos(i * 2) * 2.1, 0, -1 + i * 0.2]}>
          <sphereGeometry args={[0.18 + (i % 2) * 0.12, 16, 12]} />
          <meshPhysicalMaterial
            color="#c0eaff"
            roughness={0.12}
            transparent
            opacity={0.24}
            metalness={0.15}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
function ScanBeam({ run }: { run: AnimationRun }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const c = run.clock;
    ref.current.position.y =
      run.mode === "initial"
        ? 2 - 4 * Math.min(1, c.formation)
        : 1.8 - 3.6 * Math.min(1, c.time / 0.9);
    ref.current.visible = c.time < (run.mode === "initial" ? 1.7 : 1.1);
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 1.5]} />
        <meshBasicMaterial
          color="#70dcff"
          transparent
          opacity={0.12}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.65, 0.013, 6, 90]} />
        <meshBasicMaterial color="#91e8ff" transparent opacity={0.75} />
      </mesh>
    </group>
  );
}
function Metrics({ run }: { run: AnimationRun }) {
  const { gl } = useThree();
  useFrame((_, delta) => {
    const stats = run.performance;
    stats.frames++;
    if (stats.frameMs.length < 600) stats.frameMs.push(delta * 1000);
    stats.drawCalls = Math.max(stats.drawCalls, gl.info.render.calls);
    stats.triangles = Math.max(stats.triangles, gl.info.render.triangles);
  });
  return null;
}
export function preloadAnimationModel(id: AnimationTemplateId) {
  const cfg = animationRegistry[id];
  useGLTF.preload(innerWidth < 600 ? cfg.assets.mobile : cfg.assets.desktop);
}
export default function AnimationCanvas({
  run,
  onReady,
}: {
  run: AnimationRun;
  onReady: () => void;
}) {
  const { variant, visible } = useScenePerformance();
  const cfg = animationRegistry[run.templateId],
    preset = cfg.camera[variant];
  useEffect(() => {
    run.performance.dpr = preset.dpr;
    run.performance.variant = variant;
  }, [run, preset.dpr, variant]);
  return (
    <Canvas
      frameloop={visible ? "always" : "never"}
      dpr={preset.dpr}
      camera={{ position: preset.position, fov: preset.fov }}
      gl={{
        alpha: true,
        antialias: variant !== "mobile",
        powerPreference: "low-power",
        localClippingEnabled: true,
      }}
    >
      <ambientLight intensity={run.templateId === "04" ? 0.9 : 1.3} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={preset.lightIntensity}
        color={run.templateId === "04" ? "#ffecc4" : "#eff6ff"}
      />
      <directionalLight
        position={[-3, 0, 3]}
        intensity={2}
        color={cfg.theme.secondary}
      />
      <pointLight
        position={[0, 2, -3]}
        intensity={7}
        color={cfg.theme.primary}
      />
      <Suspense fallback={null}>
        <Environment resolution={64} frames={1}>
          <Lightformer
            intensity={3}
            position={[0, 4, -3]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[8, 8, 1]}
          />
          <Lightformer
            intensity={2}
            color={cfg.theme.secondary}
            position={[-4, 0, 1]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[4, 6, 1]}
          />
        </Environment>
        <Model run={run} preset={preset} onReady={onReady} />
        <Particles run={run} preset={preset} />
      </Suspense>
      <Rings run={run} preset={preset} />
      <Outline run={run} />
      {run.templateId === "03" && <MascotDecor run={run} />}{" "}
      {run.templateId === "06" && (
        <>
          <gridHelper
            args={[10, 20, "#176e9c", "#10435c"]}
            position={[0, -1.9, -1]}
          />
          <ScanBeam run={run} />
        </>
      )}
      <Metrics run={run} />
    </Canvas>
  );
}
