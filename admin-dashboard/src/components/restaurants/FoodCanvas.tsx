"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import * as T from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
function interpolate(values: number[], progress: number) {
  const scaled =
      Math.max(0, Math.min(0.999999, progress)) * (values.length - 1),
    index = Math.floor(scaled),
    fraction = scaled - index;
  return values[index] + (values[index + 1] - values[index]) * fraction;
}
export type FoodClock = { progress: number; chapter: number; manual: boolean };
function FoodModel({
  url,
  clockRef,
  open,
  assembly,
  ingredients,
  onReady,
  reduced,
}: {
  url: string;
  clockRef: React.RefObject<FoodClock>;
  open: boolean;
  assembly: number;
  ingredients: string[];
  onReady: () => void;
  reduced: boolean;
}) {
  const { scene } = useGLTF(url),
    invalidate = useThree((s) => s.invalidate);
  const modelRoot = useRef<T.Group>(null);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o instanceof T.Mesh)
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
    });
    return clone;
  }, [scene]);
  useEffect(() => {
    invalidate();
    onReady();
    return () =>
      model.traverse((o) => {
        if (o instanceof T.Mesh)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
  }, [model, invalidate, onReady]);
  useFrame((_, dt) => {
    const p = clockRef.current.progress;
    const lid = model.getObjectByName("Lid");
    if (lid) {
      const target = open
        ? 1.25
        : reduced
          ? 0
          : interpolate([0, 0.5, 1.45, 1.15, 0.55, 0.35, 0], p);
      lid.position.y = T.MathUtils.damp(
        lid.position.y,
        target,
        reduced ? 100 : 6,
        Math.min(dt, 0.1),
      );
      lid.rotation.z = lid.position.y * 0.2;
    }
    const veg = model.getObjectByName("Vegetables"),
      protein = model.getObjectByName("Protein"),
      spices = model.getObjectByName("Spices"),
      pack = model.getObjectByName("Packaging");
    if (veg)
      veg.position.y = T.MathUtils.damp(
        veg.position.y,
        assembly * 0.75 +
          (reduced ? 0 : interpolate([0, 0, 0.18, 0.03, 0, 0, 0], p)),
        reduced ? 100 : 6,
        Math.min(dt, 0.1),
      );
    if (protein)
      protein.position.y = T.MathUtils.damp(
        protein.position.y,
        assembly * 0.45 +
          (reduced ? 0 : interpolate([0, 0, 0.32, 0.02, 0, 0, 0], p)),
        reduced ? 100 : 6,
        Math.min(dt, 0.1),
      );
    if (veg && ingredients.length)
      veg.scale.setScalar(ingredients.includes("avocado") ? 1.12 : 1);
    if (protein && ingredients.length)
      protein.scale.setScalar(ingredients.includes("tofu") ? 1.2 : 1);
    if (spices) {
      spices.rotation.y = reduced ? 0 : p * Math.PI * 2;
      spices.position.y = assembly * 0.5;
    }
    if (pack)
      pack.scale.setScalar(
        reduced
          ? 0.001
          : Math.max(0.001, interpolate([0, 0, 0, 0, 0.3, 1, 0], p)),
      );
    if (modelRoot.current && !clockRef.current.manual && !reduced)
      modelRoot.current.rotation.y = interpolate(
        [0.12, -0.15, 0.05, 0.2, -0.25, 0.1, 0.12],
        p,
      );
  });
  return (
    <group ref={modelRoot}>
      <primitive object={model} dispose={null} />
    </group>
  );
}
function Rig({
  clockRef,
  preset,
  reset,
  reduced,
  visible,
}: {
  clockRef: React.RefObject<FoodClock>;
  preset: number;
  reset: number;
  reduced: boolean;
  visible: boolean;
}) {
  const controls = useRef<Controls>(null),
    goal = useMemo(() => new T.Vector3(), []),
    moving = useRef(true),
    invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    goal.set(
      ...([
        [3.7, 2.8, 4.7],
        [0, 5.8, 0.1],
        [4, 0.9, 1],
        [0, 1.8, 5.8],
      ][preset] as [number, number, number]),
    );
    moving.current = true;
    invalidate();
  }, [preset, reset, goal, reduced, invalidate]);
  useFrame(({ camera }, dt) => {
    if (!visible) return;
    if (!clockRef.current.manual && !reduced) {
      const p = clockRef.current.progress;
      goal.set(
        interpolate([3.4, 3.8, 0.3, 0, 3.6, 3.3, 3.4], p),
        interpolate([2.2, 2.8, 5.6, 4.4, 2.5, 2.8, 2.2], p),
        interpolate([4.4, 4.6, 2.2, 4.1, 4.2, 4.4, 4.4], p),
      );
      moving.current = true;
    }
    if (moving.current) {
      camera.position.lerp(
        goal,
        reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 5),
      );
      controls.current?.target.set(0, 0.3, 0);
      controls.current?.update();
      if (camera.position.distanceTo(goal) < 0.01) moving.current = false;
      else invalidate();
    }
  });
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableZoom={false}
      enableDamping={!reduced}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        clockRef.current.manual = true;
        moving.current = false;
      }}
    />
  );
}
function Steam({ enabled, reduced }: { enabled: boolean; reduced: boolean }) {
  const refs = useRef<T.Mesh[]>([]);
  useFrame(({ clock: clockRef }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const p = reduced ? 0.4 : (clockRef.elapsedTime * 0.14 + i * 0.19) % 1;
      m.position.set(
        Math.sin(i * 2 + p * 5) * 0.32,
        1 + p * 1.5,
        Math.cos(i * 3 + p * 3) * 0.3,
      );
      m.scale.setScalar(0.15 + p * 0.3);
      (m.material as T.MeshBasicMaterial).opacity = enabled
        ? (1 - p) * 0.12
        : 0;
    });
  });
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          ref={(e) => {
            if (e) refs.current[i] = e;
          }}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial
            color="#fff5dc"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
function StudioEnvironment() {
  const gl = useThree((s) => s.gl),
    scene = useThree((s) => s.scene),
    invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const room = new RoomEnvironment(),
      generator = new T.PMREMGenerator(gl),
      target = generator.fromScene(room, 0.04);
    Object.assign(scene, { environment: target.texture });
    invalidate();
    return () => {
      Object.assign(scene, { environment: null });
      target.dispose();
      generator.dispose();
      room.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}
function Monitor({ onError }: { onError: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const c = gl.domElement,
      fn = () => {
        if (c.isConnected) onError();
      };
    c.addEventListener("webglcontextlost", fn);
    return () => c.removeEventListener("webglcontextlost", fn);
  }, [gl, onError]);
  return null;
}
export default function FoodCanvas({
  url,
  clockRef,
  open,
  assembly,
  ingredients,
  preset,
  reset,
  reduced,
  visible,
  onReady,
  onError,
}: {
  url: string;
  clockRef: React.RefObject<FoodClock>;
  open: boolean;
  assembly: number;
  ingredients: string[];
  preset: number;
  reset: number;
  reduced: boolean;
  visible: boolean;
  onReady: () => void;
  onError: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={visible && !reduced ? "always" : "demand"}
      camera={{ position: [3.7, 2.8, 4.7], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      fallback={<span>Use the illustrated food guide below.</span>}
    >
      <Monitor onError={onError} />
      <StudioEnvironment />
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, 6, 4]} intensity={3.5} color="#ffe7c6" />
      <directionalLight
        position={[-4, 3, -3]}
        intensity={1.4}
        color="#f5d3a0"
      />
      <Suspense fallback={null}>
        <FoodModel
          url={url}
          clockRef={clockRef}
          open={open}
          assembly={assembly}
          ingredients={ingredients}
          onReady={onReady}
          reduced={reduced}
        />
      </Suspense>
      <Steam enabled={open || url.includes("biryani")} reduced={reduced} />
      <Rig
        clockRef={clockRef}
        preset={preset}
        reset={reset}
        reduced={reduced}
        visible={visible}
      />
    </Canvas>
  );
}
