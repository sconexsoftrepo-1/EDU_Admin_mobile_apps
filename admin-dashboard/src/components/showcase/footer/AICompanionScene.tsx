"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { MathUtils, Shape, type Group, type Mesh } from "three";
export type CompanionMood =
  "idle" | "greeting" | "happy" | "curious" | "excited" | "email" | "phone";
const chestStar = new Shape();
chestStar.moveTo(0, 0.17);
for (const [x, y] of [
  [0.04, 0.04],
  [0.17, 0],
  [0.04, -0.04],
  [0, -0.17],
  [-0.04, -0.04],
  [-0.17, 0],
  [-0.04, 0.04],
  [0, 0.17],
])
  chestStar.lineTo(x, y);
function Robot({
  mood,
  pointer,
}: {
  mood: CompanionMood;
  pointer: RefObject<{ x: number; y: number }>;
}) {
  const body = useRef<Group>(null),
    head = useRef<Group>(null),
    arm = useRef<Group>(null),
    eyes = useRef<Group>(null),
    halo = useRef<Mesh>(null);
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime,
      d = Math.min(delta, 0.05);
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.4) * 0.055;
      body.current.rotation.y = MathUtils.damp(
        body.current.rotation.y,
        pointer.current.x * 0.3,
        6,
        d,
      );
    }
    if (head.current) {
      head.current.rotation.x = MathUtils.damp(
        head.current.rotation.x,
        -pointer.current.y * 0.12,
        6,
        d,
      );
      head.current.rotation.z = MathUtils.damp(
        head.current.rotation.z,
        mood === "curious" ? 0.18 : mood === "email" ? -0.12 : 0,
        6,
        d,
      );
    }
    if (arm.current) {
      arm.current.rotation.z = MathUtils.damp(
        arm.current.rotation.z,
        mood === "email"
          ? -1.1
          : mood === "phone" ||
              mood === "greeting" ||
              mood === "happy" ||
              mood === "curious" ||
              mood === "excited"
            ? -0.9 + Math.sin(t * 10) * 0.25
            : -0.18,
        8,
        d,
      );
    }
    if (eyes.current) {
      const blink = t % 4.8 < 0.13 ? 0.12 : 1;
      eyes.current.scale.y = MathUtils.damp(
        eyes.current.scale.y,
        blink * (mood === "happy" ? 0.7 : mood === "excited" ? 1.2 : 1),
        20,
        d,
      );
    }
    if (halo.current) halo.current.rotation.z = t * 0.17;
  });
  return (
    <group ref={body} rotation={[0, -0.12, 0]}>
      <group ref={head} position={[0, 0.48, 0]}>
        <mesh>
          <sphereGeometry args={[0.75, 36, 24]} />
          <meshStandardMaterial
            color="#ecedf6"
            metalness={0.42}
            roughness={0.23}
          />
        </mesh>
        <mesh position={[0, -0.02, 0.58]} scale={[1, 0.6, 0.35]}>
          <sphereGeometry args={[0.62, 32, 20]} />
          <meshStandardMaterial
            color="#11162d"
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>
        <group ref={eyes}>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.23, 0.02, 0.79]}>
              <mesh scale={[1, mood === "curious" && side === 1 ? 0.75 : 1, 1]}>
                <sphereGeometry args={[0.105, 20, 16]} />
                <meshBasicMaterial
                  color={mood === "excited" ? "#bb9bff" : "#67e8f9"}
                />
              </mesh>
              <mesh position={[-0.018, 0.025, 0.085]}>
                <sphereGeometry args={[0.022, 10, 8]} />
                <meshBasicMaterial color="#fff" />
              </mesh>
            </group>
          ))}
        </group>
        <mesh position={[0, -0.25, 0.73]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.105, 0.014, 8, 20, Math.PI]} />
          <meshBasicMaterial color="#91b8e8" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.73, 0.02, 0]}
            rotation={[0, 0, s * 0.2]}
          >
            <capsuleGeometry args={[0.1, 0.19, 4, 12]} />
            <meshStandardMaterial
              color="#a19adb"
              metalness={0.5}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.48, 0]} scale={[0.83, 1, 0.65]}>
        <capsuleGeometry args={[0.43, 0.26, 6, 24]} />
        <meshStandardMaterial
          color="#e9eafa"
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, -0.35, 0.31]}>
        <shapeGeometry args={[chestStar]} />
        <meshBasicMaterial color="#9677e4" />
      </mesh>
      <group ref={arm} position={[0.43, -0.2, 0]}>
        <mesh position={[0.18, -0.19, 0]} rotation={[0, 0, 0.35]}>
          <capsuleGeometry args={[0.09, 0.33, 5, 14]} />
          <meshStandardMaterial
            color="#dcdeee"
            metalness={0.4}
            roughness={0.25}
          />
        </mesh>
      </group>
      <mesh position={[-0.6, -0.4, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.09, 0.33, 5, 14]} />
        <meshStandardMaterial
          color="#dcdeee"
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={halo} rotation={[1.25, 0, 0.1]} position={[0, -1.05, 0]}>
        <torusGeometry args={[0.76, 0.015, 6, 60]} />
        <meshBasicMaterial color="#8c6ee9" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
export default function AICompanionScene({
  mood,
  pointer,
  onReady,
}: {
  mood: CompanionMood;
  pointer: RefObject<{ x: number; y: number }>;
  onReady: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.4]}
      camera={{ position: [0, 0.15, 4.7], fov: 39 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      onCreated={onReady}
    >
      <ambientLight intensity={1.8} />
      <directionalLight position={[2, 4, 4]} intensity={3} />
      <directionalLight position={[-3, 1, 2]} intensity={2.5} color="#b7a4ff" />
      <directionalLight position={[2, -1, 1]} intensity={1.5} color="#82dcf3" />
      <Robot mood={mood} pointer={pointer} />
    </Canvas>
  );
}
