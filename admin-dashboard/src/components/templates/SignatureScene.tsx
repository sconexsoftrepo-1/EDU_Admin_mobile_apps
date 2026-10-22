"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Group, Mesh } from "three";
function Model({ id, onReady }: { id: string; onReady: () => void }) {
  const { scene } = useGLTF(
    `/assets/animations/template-${id}/models/dental.glb`,
  );
  const root = useRef<Group>(null);
  const { invalidate } = useThree();
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry = o.geometry.clone();
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return c;
  }, [scene]);
  useEffect(() => {
    onReady();
    invalidate();
    return () =>
      clone.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
  }, [clone, onReady, invalidate]);
  return (
    <group
      ref={root}
      rotation={[0.08, -0.15, 0]}
      onPointerMove={(e) => {
        if (!root.current) return;
        root.current.rotation.y = e.pointer.x * 0.3;
        root.current.rotation.x = e.pointer.y * -0.1;
        invalidate();
      }}
      onPointerOut={() => {
        if (root.current) {
          root.current.rotation.set(0.08, -0.15, 0);
          invalidate();
        }
      }}
    >
      <primitive object={clone} dispose={null} />
    </group>
  );
}
export default function SignatureScene({
  id,
  onReady,
}: {
  id: string;
  onReady: () => void;
}) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ position: [0, 0, 5.8], fov: 38 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[2, 3, 5]} intensity={3} />
      <directionalLight position={[-3, 1, 3]} intensity={1.5} color="#ffd1e5" />
      <Suspense fallback={null}>
        <Model id={id} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
