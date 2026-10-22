"use client";
import { Component, type ReactNode } from "react";
import Image from "next/image";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
export default function CampusScene({
  blue,
  selected,
  onSelect,
}: {
  blue: boolean;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const buildings = [
    [-2, 0, -1],
    [0, 0, -1],
    [2, 0, -1],
    [-2, 0, 1],
    [0, 0, 1],
    [2, 0, 1],
    [-3, 0, 3],
    [2, 0, 3],
  ];
  return (
    <CampusBoundary blue={blue}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [8, 7, 9], fov: 40 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[blue ? "#e7f0fc" : "#eee7d8"]} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 8, 3]} intensity={2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 12]} />
          <meshStandardMaterial color="#91a98b" />
        </mesh>
        {buildings.map((p, i) => (
          <group
            key={i}
            position={p as [number, number, number]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <mesh position={[0, i === 1 ? 1.2 : 0.65, 0]}>
              <boxGeometry args={[1.5, i === 1 ? 2.4 : 1.3, 1.15]} />
              <meshStandardMaterial
                color={
                  selected === i ? "#edb84b" : blue ? "#356b99" : "#e9d2ac"
                }
                roughness={0.5}
                metalness={blue ? 0.3 : 0}
              />
            </mesh>
            {[0, 1, 2].map((j) => (
              <mesh key={j} position={[-0.48 + j * 0.48, 0.8, 0.585]}>
                <boxGeometry args={[0.22, 0.55, 0.03]} />
                <meshStandardMaterial color="#d7f0ff" />
              </mesh>
            ))}
            <mesh position={[0, i === 1 ? 2.45 : 1.35, 0]}>
              <boxGeometry args={[1.7, 0.12, 1.3]} />
              <meshStandardMaterial color={blue ? "#08213e" : "#a77524"} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 10]} />
          <meshStandardMaterial color="#ded8c8" />
        </mesh>
        {blue ? (
          <group>
            <mesh position={[0, 1.8, -1]}>
              <cylinderGeometry args={[1.05, 1.05, 3.6, 20]} />
              <meshStandardMaterial
                color={selected === 1 ? "#edb84b" : "#396f9f"}
                metalness={0.55}
                roughness={0.25}
              />
            </mesh>
            {[0.5, 1.1, 1.7, 2.3, 2.9, 3.5].map((y) => (
              <mesh key={y} position={[0, y, -1]}>
                <torusGeometry args={[1.06, 0.025, 6, 24]} />
                <meshStandardMaterial color="#81daee" />
              </mesh>
            ))}
            <mesh position={[0, 1.6, 1.2]}>
              <boxGeometry args={[4.6, 0.16, 0.4]} />
              <meshStandardMaterial color="#83b8d5" />
            </mesh>
            <mesh position={[-2, 0.5, 3]} rotation={[0, 0, 0.4]}>
              <torusKnotGeometry args={[0.4, 0.07, 48, 8]} />
              <meshStandardMaterial
                color="#22c9f2"
                metalness={0.5}
                roughness={0.3}
              />
            </mesh>
          </group>
        ) : (
          <group>
            {[-0.55, 0, 0.55].map((x) => (
              <mesh key={x} position={[x, 1.2, -0.35]}>
                <cylinderGeometry args={[0.08, 0.1, 2.4, 8]} />
                <meshStandardMaterial color="#fff3df" />
              </mesh>
            ))}
            <mesh position={[0, 2.75, -1]}>
              <sphereGeometry
                args={[0.65, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial color="#b38844" />
            </mesh>
            <mesh position={[-2, 0.12, 3]}>
              <boxGeometry args={[1.3, 0.2, 0.85]} />
              <meshStandardMaterial color="#e8c87f" />
            </mesh>
          </group>
        )}
        <OrbitControls
          enablePan={false}
          minDistance={7}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.3}
        />
      </Canvas>
    </CampusBoundary>
  );
}
class CampusBoundary extends Component<
  {
    blue: boolean;
    children: ReactNode;
  },
  {
    failed: boolean;
  }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="college-campus-fallback">
          <Image
            src={`/assets/colleges-institutions/${"edunexa-college"}/campus.webp`}
            alt="Static campus alternative"
            fill
            sizes="60vw"
          />
          <p>
            3D rendering is unavailable. Explore all destinations using the
            adjacent campus list.
          </p>
        </div>
      );
    return this.props.children;
  }
}
