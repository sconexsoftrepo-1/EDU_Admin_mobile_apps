"use client";
import { useState, useMemo, useEffect } from "react";
import { CanvasTexture } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Vehicle, Passenger } from "@/lib/colleges/operations";
const colors = {
  Available: "#20a880",
  Student: "#197af4",
  Faculty: "#197af4",
  Staff: "#197af4",
  Reserved: "#ec9d29",
  Unavailable: "#657587",
};
function Box({
  position,
  size,
  color,
  transparent = false,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  transparent?: boolean;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={transparent}
        opacity={transparent ? 0.25 : 1}
        roughness={0.45}
        metalness={0.25}
      />
    </mesh>
  );
}
function SceneLabel({
  text,
  position,
  wide = false,
}: {
  text: string;
  position: [number, number, number];
  wide?: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = wide ? 256 : 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#061325";
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, 32);
    return new CanvasTexture(canvas);
  }, [text, wide]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  return (
    <sprite position={position} scale={[wide ? 1.7 : 0.4, 0.4, 1]}>
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
export default function BusScene({
  bus,
  passengers,
  selected,
  onSelect,
  roof,
  labels,
  view,
  gold,
}: {
  bus: Vehicle;
  passengers: Passenger[];
  selected: string;
  onSelect: (s: string) => void;
  roof: boolean;
  labels: boolean;
  view: string;
  gold: boolean;
}) {
  const [hovered, setHovered] = useState("");
  const rows = Math.max(...bus.seats.map((s) => s.row)) + 1,
    length = rows * 0.65 + 2.2;
  const columns = Math.max(...bus.seats.map((s) => s.column)) + 1;
  const width = columns * 0.65 + 0.8,
    half = width / 2;
  const seatPosition = (
    seat: Vehicle["seats"][number],
  ): [number, number, number] => [
    (seat.column - (columns - 1) / 2) * 0.65 +
      (seat.column < Math.floor(columns / 2) ? -0.18 : 0.18),
    0.35,
    seat.row * 0.65 - length / 2 + 1.7,
  ];
  const selectedSeat = bus.seats.find((s) => s.id === selected) || bus.seats[0];
  const focus = seatPosition(selectedSeat);
  const cameras: Record<string, [number, number, number]> = {
    Cutaway: [8, 9, 12],
    Top: [0, 18, 0.01],
    Front: [0, 5, -13],
    Rear: [0, 5, 13],
    Exterior: [10, 5, 13],
    "Seat focus": [focus[0] + 3, 5, focus[2] + 4],
  };
  const body = gold ? "#c99445" : "#1769ff";
  return (
    <Canvas
      key={view + (view === "Seat focus" ? selected : "")}
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: cameras[view] || cameras.Cutaway, fov: 45 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      aria-label="Interactive three dimensional college bus"
    >
      <color attach="background" args={[gold ? "#eee4d1" : "#061325"]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 10, 5]} intensity={2} />
      <group position={[0, 0, 0]}>
        <Box position={[0, 0, 0]} size={[width, 0.25, length]} color={body} />
        <Box
          position={[0, 0.4, -length / 2 + 0.6]}
          size={[width - 0.1, 0.8, 1.2]}
          color={body}
        />
        <Box
          position={[0, 1.2, -length / 2 + 0.35]}
          size={[width - 0.2, 1, 0.12]}
          color="#8bc2d6"
          transparent
        />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Box
              position={[side * (half - 0.05), 0.55, 0]}
              size={[0.12, 1.1, length]}
              color={body}
            />
            <Box
              position={[side * (half - 0.05), 1.6, 0]}
              size={[0.07, 0.9, length - 1.5]}
              color="#9fdcf3"
              transparent
            />
            {Array.from({ length: rows + 1 }, (_, i) => (
              <Box
                key={i}
                position={[
                  side * (half - 0.05),
                  1.6,
                  i * 0.65 - length / 2 + 1,
                ]}
                size={[0.05, 1, 0.06]}
                color={body}
              />
            ))}
            {[-length / 2 + 1.5, length / 2 - 1.3].map((z) => (
              <mesh
                key={z}
                position={[side * (half - 0.05), -0.15, z]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.48, 0.48, 0.3, 18]} />
                <meshStandardMaterial color="#17202a" />
              </mesh>
            ))}
          </group>
        ))}
        {roof && (
          <Box
            position={[0, 2.15, 0]}
            size={[width, 0.15, length]}
            color={body}
          />
        )}
        <Box
          position={[-0.8, 0.6, -length / 2 + 0.65]}
          size={[0.65, 0.65, 0.65]}
          color="#304052"
        />
        <SceneLabel
          position={[-0.8, 1.2, -length / 2 + 0.65]}
          text="Driver / crew"
          wide
        />
        <Box
          position={[0, 0.15, 0.5]}
          size={[0.38, 0.04, length - 1.5]}
          color="#415466"
        />
        <Box
          position={[half, 1, -length / 2 + 1]}
          size={[0.06, 1.7, 0.6]}
          color="#92d3e8"
          transparent
        />
        {[-1, 1].map((side) => (
          <group key={"lamps" + side}>
            <Box
              position={[side * (half - 0.4), 0.42, -length / 2 - 0.03]}
              size={[0.4, 0.16, 0.06]}
              color="#ffe2a1"
            />
            <Box
              position={[side * (half - 0.4), 0.5, length / 2 + 0.03]}
              size={[0.3, 0.25, 0.06]}
              color="#f55454"
            />
          </group>
        ))}
        {bus.seats.map((seat) => {
          const p = passengers.find((p) => p.seatId === seat.id),
            color = colors[p?.kind || seat.status];
          const [x, , z] = seatPosition(seat);
          return (
            <group
              key={seat.id}
              position={[x, 0.35, z]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(seat.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                setHovered(seat.id);
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
                setHovered("");
              }}
            >
              {(seat.id === selected || seat.id === hovered) && (
                <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.31, 0.39, 24]} />
                  <meshBasicMaterial
                    color={seat.id === selected ? "#ffd36d" : "#ffffff"}
                    side={2}
                  />
                </mesh>
              )}
              <Box
                position={[0, 0.1, 0]}
                size={[0.55, 0.22, 0.5]}
                color={color}
              />
              <Box
                position={[0, 0.4, 0.23]}
                size={[0.55, 0.65, 0.1]}
                color={color}
              />
              {labels && (
                <SceneLabel
                  text={`${seat.id}${p ? " *" : ""}`}
                  position={[0, 0.85, 0]}
                />
              )}
            </group>
          );
        })}
      </group>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={5}
        maxDistance={28}
        target={view === "Seat focus" ? focus : [0, 0.4, 0]}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
