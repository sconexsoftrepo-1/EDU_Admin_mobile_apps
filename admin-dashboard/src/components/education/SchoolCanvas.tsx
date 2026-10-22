"use client";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import * as THREE from "three";
export type WorldPoint = {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
};
function Model({
  url,
  selected,
  onReady,
}: {
  url: string;
  selected: string;
  onReady: () => void;
}) {
  const { scene } = useGLTF(url);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    onReady();
  }, [scene, invalidate, onReady]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return clone;
  }, [scene]);
  useEffect(() => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials)
          if (m instanceof THREE.MeshStandardMaterial) {
            m.emissive.set(
              o.userData.featureId === selected ? "#dfb970" : "#000000",
            );
            m.emissiveIntensity = 0.2;
          }
      }
    });
  }, [model, selected]);
  useEffect(
    () => () => {
      model.traverse((o) => {
        if (o instanceof THREE.Mesh)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
    },
    [model],
  );
  return <primitive object={model} dispose={null} />;
}
function Camera({
  preset,
  reset,
  reduced,
  progress,
  scroll,
  manualRef,
}: {
  preset: number;
  reset: number;
  reduced: boolean;
  progress: React.RefObject<number>;
  scroll: boolean;
  manualRef: React.RefObject<boolean>;
}) {
  const control = useRef<Controls>(null),
    moving = useRef(true);
  const invalidate = useThree((s) => s.invalidate);
  const target = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    target.set(
      ...([
        [7, 5, 8],
        [4, 2.4, 5],
        [-5, 3, 3],
        [0, 7, 1],
        [2, 2, 5],
        [5, 3, -4],
      ][preset] as [number, number, number]),
    );
    moving.current = true;
    invalidate();
  }, [target, preset, reset, reduced, invalidate]);
  useFrame(({ camera }, dt) => {
    if (scroll && !manualRef.current && !reduced) {
      target.set(
        7 - progress.current * 2.5,
        5 - progress.current * 1.4,
        8 - progress.current * 3,
      );
      moving.current = true;
    }
    if (!moving.current) return;
    camera.position.lerp(
      target,
      reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 5),
    );
    control.current?.target.set(0, 0.5, 0);
    control.current?.update();
    if (camera.position.distanceTo(target) < 0.02) moving.current = false;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={control}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping={!reduced}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI * 0.48}
      onStart={() => {
        manualRef.current = true;
        moving.current = false;
      }}
    />
  );
}
function Project({
  points,
  buttons,
}: {
  points: WorldPoint[];
  buttons: React.RefObject<(HTMLButtonElement | null)[]>;
}) {
  const size = useThree((s) => s.size),
    v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    points.forEach((p, i) => {
      const b = buttons.current[i];
      if (!b) return;
      v.set(...p.position).project(camera);
      b.style.transform = `translate(${((v.x + 1) * size.width) / 2}px,${((1 - v.y) * size.height) / 2}px) translate(-50%,-50%)`;
      b.style.visibility = v.z > 1 ? "hidden" : "visible";
    });
  });
  return null;
}
function ContextMonitor({ onError }: { onError: () => void }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = () => {
      if (canvas.isConnected) onError();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onError]);
  return null;
}
export default function SchoolCanvas({
  url,
  points,
  selected,
  onSelect,
  preset,
  reset,
  reduced,
  progress,
  scroll,
  manualRef,
  onError,
  fallback,
}: {
  url: string;
  points: WorldPoint[];
  selected: string;
  onSelect: (id: string) => void;
  preset: number;
  reset: number;
  reduced: boolean;
  progress: React.RefObject<number>;
  scroll: boolean;
  manualRef: React.RefObject<boolean>;
  onError: () => void;
  fallback: React.ReactNode;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const modelReady = useCallback(() => setReady(true), []);
  return (
    <div className="school-canvas-layer" data-model-ready={ready}>
      <Canvas
        dpr={[1, 1.35]}
        camera={{ position: [7, 5, 8], fov: 43 }}
        frameloop={reduced ? "demand" : "always"}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        fallback={fallback}
      >
        <ContextMonitor onError={onError} />
        <ambientLight intensity={1.8} />
        <directionalLight intensity={2.6} position={[4, 8, 5]} />
        <directionalLight
          intensity={0.8}
          position={[-4, 3, -4]}
          color="#dae9ff"
        />
        <Suspense fallback={null}>
          <Model url={url} selected={selected} onReady={modelReady} />
        </Suspense>
        <Camera
          preset={preset}
          reset={reset}
          reduced={reduced}
          progress={progress}
          scroll={scroll}
          manualRef={manualRef}
        />
        <Project points={points} buttons={buttons} />
      </Canvas>
      {!ready && (
        <span className="school-model-loading" role="status">
          Loading the 3D model…
        </span>
      )}
      <div className="school-spatial-points">
        {points.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            onClick={() => onSelect(p.id)}
            aria-label={`Explore ${p.name}`}
            className={selected === p.id ? "is-selected" : ""}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
