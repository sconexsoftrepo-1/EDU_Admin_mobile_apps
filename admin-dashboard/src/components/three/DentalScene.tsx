"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { Group, CatmullRomCurve3, Vector3, SphereGeometry } from "three";
import type { TemplateId } from "@/data/experiences";
export type SceneProps = {
  id: TemplateId | "01";
  rotation: number;
  assembly: number;
  wireframe: boolean;
  rose: boolean;
  greeting: boolean;
  spin: boolean;
};
function Crown({
  color,
  metalness = 0.12,
  transparent = false,
  wireframe = false,
}: {
  color: string;
  metalness?: number;
  transparent?: boolean;
  wireframe?: boolean;
}) {
  const geometry = useMemo(() => {
    const g = new SphereGeometry(1, 48, 32);
    const position = g.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        y = position.getY(i),
        z = position.getZ(i);
      const angle = Math.atan2(z, x);
      const radial = Math.sqrt(x * x + z * z);
      const cusp = (Math.cos(angle * 4 - Math.PI) + 1) * 0.5;
      const occlusal =
        y > 0.2
          ? 0.22 * cusp * radial * Math.min(1, (y - 0.2) * 3) -
            0.2 * Math.pow(Math.max(0, (y - 0.6) / 0.4), 2)
          : 0;
      const squareness = 1 + 0.07 * Math.cos(angle * 4 - Math.PI) * radial;
      position.setXYZ(
        i,
        x * (0.77 + 0.06 * y) * squareness,
        y * 0.58 + occlusal,
        z * (0.62 + 0.04 * y) * squareness,
      );
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color={color}
        roughness={metalness > 0.5 ? 0.23 : 0.16}
        metalness={metalness}
        clearcoat={1}
        clearcoatRoughness={0.12}
        transparent={transparent}
        opacity={transparent ? 0.36 : 1}
        wireframe={wireframe}
      />
    </mesh>
  );
}
function Roots({
  color,
  wireframe = false,
  transparent = false,
}: {
  color: string;
  wireframe?: boolean;
  transparent?: boolean;
}) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.32, -0.83, 0]}
          rotation={[0, 0, -side * 0.16]}
          scale={[0.26, 0.73, 0.29]}
        >
          <sphereGeometry args={[1, 20, 18]} />
          <meshPhysicalMaterial
            color={color}
            metalness={0.08}
            roughness={0.2}
            clearcoat={1}
            wireframe={wireframe}
            transparent={transparent}
            opacity={transparent ? 0.3 : 1}
          />
        </mesh>
      ))}
    </group>
  );
}
function Implant({
  gold = false,
  assembly = 0,
}: {
  gold?: boolean;
  assembly?: number;
}) {
  const metal = gold ? "#d9ac55" : "#a6b9df";
  return (
    <group position={[0, 0.4, 0]}>
      <group position={[0, assembly * 0.8 + 0.65, 0]}>
        <Crown color={gold ? "#fff4d5" : "#eaf1ff"} />
      </group>
      <mesh position={[0, 0.03 + assembly * 0.16, 0]}>
        <cylinderGeometry args={[0.26, 0.35, 0.48, 32]} />
        <meshStandardMaterial color={metal} metalness={0.9} roughness={0.24} />
      </mesh>
      <group position={[0, -0.78 - assembly * 0.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.34, 0.15, 1.28, 32]} />
          <meshStandardMaterial
            color={metal}
            metalness={0.9}
            roughness={0.22}
          />
        </mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh
            key={i}
            position={[0, 0.53 - i * 0.1, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.29 - i * 0.012, 0.048, 8, 36]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.95}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
function Ribbon() {
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        Array.from({ length: 80 }, (_, i) => {
          const t = (i / 79) * Math.PI * 3;
          return new Vector3(
            Math.cos(t) * 1.4,
            (i / 79 - 0.5) * 2,
            Math.sin(t) * 0.85,
          );
        }),
      ),
    [],
  );
  return (
    <mesh>
      <tubeGeometry args={[curve, 96, 0.045, 8, false]} />
      <meshPhysicalMaterial
        color="#ee91b6"
        metalness={0.45}
        roughness={0.25}
        clearcoat={1}
      />
    </mesh>
  );
}
function Model(props: SceneProps) {
  const model = useRef<Group>(null);
  const { id, rotation, spin } = props;
  useFrame((state, delta) => {
    if (!model.current) return;
    const target = (rotation * Math.PI) / 180;
    model.current.rotation.y +=
      (target - model.current.rotation.y) * Math.min(delta * 7, 1);
    if (spin) {
      model.current.rotation.y += delta * 0.35;
      state.invalidate();
    } else if (Math.abs(target - model.current.rotation.y) > 0.001)
      state.invalidate();
  });
  const dark = id === "02" || id === "04" || id === "06";
  return (
    <group ref={model} rotation={[0.08, 0, -0.04]}>
      {id === "02" || id === "04" ? (
        <Implant gold={id === "04"} assembly={props.assembly} />
      ) : (
        <group position={[0, 0.35, 0]}>
          <Crown
            color={
              id === "03"
                ? "#fbffff"
                : id === "05"
                  ? props.rose
                    ? "#efadc8"
                    : "#f7eee8"
                  : "#82ddff"
            }
            transparent={id === "06" || id === "01"}
            wireframe={props.wireframe}
          />
          <Roots
            color={
              id === "06"
                ? "#6cd4ff"
                : id === "05"
                  ? props.rose
                    ? "#efadc8"
                    : "#f6ecec"
                  : "#ecf7fc"
            }
            transparent={id === "06" || id === "01"}
            wireframe={props.wireframe}
          />
          {id === "03" && (
            <group position={[0, 0.1, 0.54]}>
              {[-0.25, 0.25].map((x) => (
                <mesh key={x} position={[x, 0.04, 0.03]}>
                  <sphereGeometry args={[0.064, 16, 12]} />
                  <meshBasicMaterial color="#164d67" />
                </mesh>
              ))}
              <mesh position={[0, -0.17, 0.03]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.13, 0.024, 8, 24, Math.PI]} />
                <meshBasicMaterial color="#164d67" />
              </mesh>
              {props.greeting && (
                <mesh position={[0.85, 0.38, 0.05]} rotation={[0, 0, -0.7]}>
                  <capsuleGeometry args={[0.1, 0.33, 6, 12]} />
                  <meshStandardMaterial color="#e9fbff" />
                </mesh>
              )}
            </group>
          )}
          {id === "06" && (
            <group>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[side * 0.26, -0.6, 0.03]}
                  scale={[0.07, 0.66, 0.06]}
                  rotation={[0, 0, -side * 0.16]}
                >
                  <sphereGeometry args={[1, 16, 16]} />
                  <meshBasicMaterial color="#39c9ff" />
                </mesh>
              ))}
              <mesh position={[0, 0.19, 0.06]}>
                <sphereGeometry args={[0.26, 24, 24]} />
                <meshBasicMaterial color="#e7b7da" transparent opacity={0.6} />
              </mesh>
            </group>
          )}
        </group>
      )}
      {id === "05" && <Ribbon />}
      {(id === "02" || id === "06") &&
        [-0.3, 0.35].map((y, i) => (
          <mesh key={i} rotation={[1.18, 0, i * 0.5]} position={[0, y, 0]}>
            <torusGeometry args={[1.65 + i * 0.15, 0.015, 6, 100]} />
            <meshBasicMaterial
              color={id === "02" ? (i ? "#e46cec" : "#898cff") : "#42cfff"}
              transparent
              opacity={0.65}
            />
          </mesh>
        ))}
      {dark && (
        <group position={[0, -1.65, 0]}>
          <mesh>
            <cylinderGeometry args={[1.32, 1.4, 0.13, 64]} />
            <meshStandardMaterial
              color={id === "04" ? "#373024" : "#112941"}
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <torusGeometry args={[1.2, 0.018, 6, 64]} />
            <meshBasicMaterial
              color={
                id === "04" ? "#e2bc75" : id === "02" ? "#bc6aff" : "#50d9ff"
              }
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
export default function DentalScene(props: SceneProps) {
  const gold = props.id === "04";
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.2, 6.6], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight
        position={[3, 4, 4]}
        color={gold ? "#fff0b5" : "#e3eeff"}
        intensity={4}
      />
      <directionalLight
        position={[-3, 0, 2]}
        color={
          props.id === "02"
            ? "#cb77ff"
            : gold
              ? "#d79832"
              : props.id === "05"
                ? "#f4a3c5"
                : "#63d7ff"
        }
        intensity={3}
      />
      <pointLight
        position={[0, 2, -3]}
        intensity={8}
        color={gold ? "#e9bf61" : "#6bbaff"}
      />
      <Model {...props} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={0.9}
        maxPolarAngle={2.1}
      />
    </Canvas>
  );
}
