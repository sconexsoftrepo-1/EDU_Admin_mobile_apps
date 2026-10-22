"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { useMemo, useRef, useEffect, Suspense } from "react";
import {
  AdditiveBlending,
  EquirectangularReflectionMapping,
  MeshStandardMaterial,
  BackSide,
  MathUtils,
  Shape,
  ExtrudeGeometry,
  type Group,
  type Mesh,
  type Points,
  type ShaderMaterial,
} from "three";
import type { AnimationRun } from "../animation-system/config/animationRegistry";
import { vertex, fragment } from "./initialShaders";
function KCFormation({
  time,
  mobile,
  onReady,
}: {
  time: AnimationRun["clock"];
  mobile: boolean;
  onReady: () => void;
}) {
  const env = useTexture("/assets/animations/initial/textures/kc-studio.webp");
  const gltf = useGLTF("/assets/animations/initial/models/kc-initial.glb"),
    root = useRef<Group>(null),
    first = useRef(true);
  const model = useMemo(() => {
    const m = gltf.scene.clone(true);
    m.traverse((o) => {
      if ("isMesh" in o) {
        const mesh = o as Mesh;
        mesh.geometry = mesh.geometry.clone();
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();
      }
    });
    env.mapping = EquirectangularReflectionMapping;
    m.traverse((o) => {
      if ("isMesh" in o) {
        const mesh = o as Mesh;
        const mat = mesh.material as MeshStandardMaterial;
        mat.envMap = env;
        mat.envMapIntensity = 1.3;
        mat.metalness = 0.82;
        mat.roughness = 0.2;
        mat.color.set("#b9a0ff");
        mat.needsUpdate = true;
      }
    });
    return m;
  }, [gltf.scene, env]);
  useEffect(
    () => () =>
      model.traverse((o) => {
        if ("isMesh" in o) {
          const m = o as Mesh;
          m.geometry.dispose();
          (Array.isArray(m.material) ? m.material : [m.material]).forEach((v) =>
            v.dispose(),
          );
        }
      }),
    [model],
  );
  useFrame(() => {
    if (first.current) {
      first.current = false;
      onReady();
    }
    const t = time.time,
      p = MathUtils.smoothstep(t, 1.8, 2.9),
      world = MathUtils.smoothstep(t, 4, 5.2),
      arrive = MathUtils.smoothstep(t, 5.2, 5.8);
    if (root.current) {
      root.current.visible = t >= 1.8 && t < 5.5;
      root.current.scale.setScalar((mobile ? 0.72 : 1.05) * (1 - world * 0.78));
      root.current.position.y = 0.35 + world * 1.6;
      root.current.rotation.y = (1 - p) * 0.35 + Math.sin(t) * 0.025;
    }
    model.children.forEach((child, i) => {
      child.position.set(
        Math.cos(i * 1.5) * (1 - p) * 3.3,
        Math.sin(i * 2) * (1 - p) * 2,
        (1 - p) * (i % 2 ? 2 : -2),
      );
      child.rotation.z = (1 - p) * (i - 2.5) * 0.4;
    });
  });
  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}
function World({
  run,
  mobile,
  onReady,
}: {
  run: AnimationRun;
  mobile: boolean;
  onReady: () => void;
}) {
  const globe = useRef<Group>(null),
    orbit = useRef<Group>(null),
    star = useRef<Mesh>(null),
    dust = useRef<Points>(null),
    shader = useRef<ShaderMaterial>(null),
    planet = useRef<Mesh>(null);
  const arrival = useMemo(() => {
    const r = document
      .querySelector(".cosmic-hero>.cosmic-environment")
      ?.getBoundingClientRect();
    const w = innerWidth,
      h = innerHeight;
    const rect = r || { left: 0, top: h * 0.15, width: w, height: h * 0.7 };
    const depth = 2 * Math.tan((43 * Math.PI) / 360) * (mobile ? 7.5 : 8.3);
    return {
      scale: rect.height / h,
      x: ((rect.left + rect.width / 2 - w / 2) / h) * depth,
      y: (-(rect.top + rect.height / 2 - h / 2) / h) * depth,
    };
  }, [mobile]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const starGeo = useMemo(() => {
    const s = new Shape();
    s.moveTo(0, 1);
    for (const [x, y] of [
      [0.2, 0.2],
      [1, 0],
      [0.2, -0.2],
      [0, -1],
      [-0.2, -0.2],
      [-1, 0],
      [-0.2, 0.2],
      [0, 1],
    ])
      s.lineTo(x, y);
    return new ExtrudeGeometry(s, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.035,
      bevelSegments: 2,
    });
  }, []);
  useEffect(() => () => starGeo.dispose(), [starGeo]);
  const positions = useMemo(
    () =>
      new Float32Array(
        Array.from({ length: (mobile ? 140 : 360) * 3 }, (_, i) => {
          const n = Math.sin(i * 127.1 + 94.4) * 43758.5453;
          return (n - Math.floor(n) - 0.5) * 22;
        }),
      ),
    [mobile],
  );
  useFrame(({ camera, gl }, delta) => {
    const t = run.clock.time,
      travel = MathUtils.smoothstep(t, 0.8, 1.8),
      world = MathUtils.smoothstep(t, 4, 5.2),
      arrive = MathUtils.smoothstep(t, 5.2, 5.8);
    camera.position.z =
      (mobile ? 9.5 : 9.1) - travel * (mobile ? 0.5 : 1.2) + world * 1.4;
    camera.position.z = MathUtils.lerp(
      camera.position.z,
      mobile ? 7.5 : 8.3,
      arrive,
    );
    camera.position.x = world * (mobile ? 0 : -0.3) * (1 - arrive);
    camera.lookAt(0, 0, 0);
    if (shader.current) shader.current.uniforms.uTime.value = t;
    if (globe.current) {
      globe.current.visible = t >= 4;
      globe.current.scale.setScalar(
        Math.max(0.001, world) *
          MathUtils.lerp(mobile ? 0.85 : 1.2, arrival.scale, arrive),
      );
      globe.current.rotation.y = 0;
      globe.current.position.y = MathUtils.lerp(
        mobile ? -0.45 : -0.2,
        arrival.y,
        arrive,
      );
      globe.current.position.x = arrival.x * arrive;
    }
    if (planet.current)
      planet.current.rotation.y = MathUtils.lerp(t * 0.07, 0.27, arrive);
    if (orbit.current) {
      orbit.current.rotation.z = MathUtils.lerp(t * 0.13, 0.08, arrive);
      orbit.current.rotation.y = 0.21 * arrive;
    }
    if (star.current) {
      star.current.visible = t > 0.8 && t < 5.4;
      const p = MathUtils.smoothstep(t, 0.8, 1.8);
      star.current.scale.setScalar((0.12 + p * 0.26) * (1 - world * 0.7));
      star.current.position.y = 1.75;
      star.current.rotation.y = t * 0.24;
    }
    if (dust.current) {
      dust.current.rotation.z = t * 0.12;
      dust.current.position.z = (travel * 5) % 5;
      dust.current.scale.setScalar(
        1 - MathUtils.smoothstep(t, 1.8, 2.9) * 0.45 + world * 0.2,
      );
    }
    run.performance.frames++;
    run.performance.frameMs.push(delta * 1000);
    if (run.performance.frameMs.length > 360) run.performance.frameMs.shift();
    run.performance.drawCalls = gl.info.render.calls;
    run.performance.triangles = gl.info.render.triangles;
    run.performance.dpr = gl.getPixelRatio();
    run.performance.fallback = false;
    run.performance.variant = mobile
      ? "initial-cosmic-mobile"
      : "initial-cosmic-desktop";
  });
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[-3, 4, 6]} intensity={5} color="#c3adff" />
      <pointLight position={[3, -1, 4]} intensity={30} color="#22d3ee" />
      <points ref={dust}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ab94ff"
          size={mobile ? 0.025 : 0.018}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </points>
      <group ref={globe}>
        <mesh ref={planet}>
          <sphereGeometry args={[1.9, mobile ? 48 : 72, mobile ? 32 : 48]} />
          <shaderMaterial
            ref={shader}
            uniforms={uniforms}
            vertexShader={vertex}
            fragmentShader={fragment}
          />
        </mesh>
        <mesh scale={1.1}>
          <sphereGeometry args={[1.9, 40, 28]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            side={BackSide}
            blending={AdditiveBlending}
            vertexShader={vertex}
            fragmentShader={`varying vec3 vN;void main(){float g=pow(max(0.,.65-abs(vN.z)),2.);gl_FragColor=vec4(.32,.19,.95,g*.65);}`}
          />
        </mesh>
        <group ref={orbit}>
          {[
            [-0.82, 0.28, 0.22],
            [-1.13, -0.4, -0.36],
            [-0.55, 0.25, 0.6],
          ].map((r, i) => (
            <mesh key={i} rotation={r as [number, number, number]}>
              <torusGeometry
                args={[2.65 + i * 0.17, 0.012 - i * 0.003, 6, 128]}
              />
              <meshBasicMaterial
                color={i === 1 ? "#67cfff" : "#bf86ff"}
                transparent
                opacity={0.9 - i * 0.2}
              />
            </mesh>
          ))}
        </group>
      </group>
      <Suspense fallback={null}>
        <KCFormation time={run.clock} mobile={mobile} onReady={onReady} />
      </Suspense>
      <mesh ref={star} geometry={starGeo}>
        <meshStandardMaterial
          color="#ddbdff"
          emissive="#8639e7"
          emissiveIntensity={0.7}
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>
    </>
  );
}
export default function InitialCosmicScene(props: {
  run: AnimationRun;
  mobile: boolean;
  onReady: () => void;
}) {
  return (
    <Canvas
      dpr={[1, props.mobile ? 1.25 : 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 9.1], fov: 43 }}
    >
      <World {...props} />
    </Canvas>
  );
}
