"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as Controls } from "three-stdlib";
import type { Hotel } from "@/data/hotels-resorts";
function Property({ hotel }: { hotel: Hotel }) {
  const gltf = useGLTF(
    `/assets/hotels-resorts/${hotel.slug}/models/property.glb`,
  );
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={model} />;
}
function Water({ reduced }: { reduced: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, dt) => {
    if (material.current && !reduced)
      material.current.uniforms.time.value += Math.min(dt, 0.05);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
      <circleGeometry args={[6, 64]} />
      <shaderMaterial
        ref={material}
        uniforms={{ time: { value: 0 } }}
        vertexShader={`uniform float time; varying vec2 p; void main(){p=uv;vec3 v=position;v.z+=sin(v.x*4.+time)*.025+cos(v.y*5.+time*.8)*.02;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}`}
        fragmentShader={`uniform float time;varying vec2 p;void main(){float w=sin((p.x+p.y)*90.+time)*.04;gl_FragColor=vec4(vec3(.06,.42,.47)+w,1.);}`}
      />
    </mesh>
  );
}
function Rig({ preset, reduced }: { preset: number; reduced: boolean }) {
  const control = useRef<Controls>(null);
  const invalidate = useThree((state) => state.invalidate);
  const target = useMemo(
    () =>
      new THREE.Vector3(
        ...([
          [6, 5, 7],
          [4, 2.5, 4],
          [-4, 3, 3],
          [0, 6, 2],
          [0, 2, 6],
        ][preset] as [number, number, number]),
      ),
    [preset],
  );
  const moving = useRef(true);
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [target, invalidate]);
  useFrame(({ camera }, dt) => {
    if (!moving.current) return;
    camera.position.lerp(target, reduced ? 1 : 1 - Math.exp(-dt * 4));
    control.current?.target.lerp(new THREE.Vector3(0, 0.5, 0), 0.1);
    control.current?.update();
    if (camera.position.distanceTo(target) < 0.015) moving.current = false;
  });
  return (
    <OrbitControls
      ref={control}
      makeDefault
      enableZoom={false}
      enablePan={false}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI * 0.47}
      onStart={() => {
        moving.current = false;
      }}
      enableDamping={!reduced}
    />
  );
}
function ProjectedHotspots({
  hotel,
  buttons,
}: {
  hotel: Hotel;
  buttons: React.RefObject<(HTMLButtonElement | null)[]>;
}) {
  const { size } = useThree();
  const position = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    hotel.hotspots.forEach((p, i) => {
      const button = buttons.current[i];
      if (!button) return;
      position.set(...p.position).project(camera);
      button.style.transform = `translate(${((position.x + 1) / 2) * size.width}px,${((1 - position.y) / 2) * size.height}px) translate(-50%,-50%)`;
      button.style.visibility = position.z > 1 ? "hidden" : "visible";
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
export default function PropertyCanvas({
  hotel,
  preset,
  onSelect,
  onError,
  reduced,
  resetToken,
}: {
  hotel: Hotel;
  preset: number;
  onSelect: (id: string) => void;
  onError: () => void;
  reduced: boolean;
  resetToken: number;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="hotel-canvas-layer">
      <Canvas
        frameloop={reduced ? "demand" : "always"}
        camera={{ position: [6, 5, 7], fov: 42 }}
        dpr={[1, 1.4]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        fallback={<span>Use the property guide below to explore.</span>}
      >
        <ContextMonitor onError={onError} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 8, 4]} intensity={3} />
        <directionalLight
          position={[-4, 2, -3]}
          color="#bde9ef"
          intensity={1.2}
        />
        <Suspense fallback={null}>
          <Property hotel={hotel} />
          {hotel.slug !== "luxury-hotel" &&
            hotel.slug !== "mountain-retreat" && <Water reduced={reduced} />}
        </Suspense>
        <Rig key={resetToken} preset={preset} reduced={reduced} />
        <ProjectedHotspots hotel={hotel} buttons={buttons} />
      </Canvas>
      <div className="hotel-hotspot-layer">
        {hotel.hotspots.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            className="hotel-3d-hotspot"
            aria-label={`Explore ${p.name}`}
            onClick={() => onSelect(p.id)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
