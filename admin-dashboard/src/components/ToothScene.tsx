"use client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Shape } from "three";
import { useMemo } from "react";
function Tooth() {
  const shape = useMemo(() => {
    const s = new Shape();
    s.moveTo(-0.7, 0.85);
    s.bezierCurveTo(-1.45, 1.55, -1.7, 0.2, -1.15, -0.55);
    s.bezierCurveTo(-1, -1, -0.9, -1.8, -0.5, -1.65);
    s.bezierCurveTo(-0.2, -1.5, -0.35, -0.45, 0, -0.48);
    s.bezierCurveTo(0.35, -0.45, 0.2, -1.5, 0.5, -1.65);
    s.bezierCurveTo(0.9, -1.8, 1, -1, 1.15, -0.55);
    s.bezierCurveTo(1.7, 0.2, 1.45, 1.55, 0.7, 0.85);
    s.bezierCurveTo(0.2, 0.65, -0.2, 0.65, -0.7, 0.85);
    return s;
  }, []);
  return (
    <mesh position={[0, 0.2, -0.25]} rotation={[0, -0.25, 0]}>
      <extrudeGeometry
        args={[
          shape,
          {
            depth: 0.45,
            bevelEnabled: true,
            bevelSegments: 5,
            steps: 1,
            bevelSize: 0.23,
            bevelThickness: 0.23,
            curveSegments: 24,
          },
        ]}
      />
      <meshPhysicalMaterial
        color="#d6f3ff"
        metalness={0.2}
        roughness={0.13}
        clearcoat={1}
        transparent
        opacity={0.88}
      />
    </mesh>
  );
}
export default function ToothScene() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 6], fov: 48 }}
    >
      <ambientLight intensity={1.8} />
      <directionalLight position={[3, 4, 4]} intensity={4} color="#f5eeff" />
      <directionalLight position={[-3, 0, 2]} intensity={3} color="#78cfff" />
      <Tooth />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={1.1}
        maxPolarAngle={1.9}
      />
    </Canvas>
  );
}
