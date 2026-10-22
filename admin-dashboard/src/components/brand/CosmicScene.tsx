"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  AdditiveBlending,
  BackSide,
  ExtrudeGeometry,
  MathUtils,
  Shape,
  type Group,
  type Mesh,
  type ShaderMaterial,
} from "three";
import type { AnimationRun } from "../animation-system/config/animationRegistry";
const vertex = `varying vec3 vN; varying vec3 vP; void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `varying vec3 vN;varying vec3 vP;uniform float uTime;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=vP*2.8;float n=noise(p)*.55+noise(p*2.2)*.28+noise(p*5.)*.12;float veins=smoothstep(.54,.72,n+noise(p*9.)*.13);float light=clamp(dot(normalize(vN),normalize(vec3(-.6,.8,1.))),0.,1.);float rim=pow(1.-max(vN.z,0.),3.);vec3 col=mix(vec3(.014,.023,.09),vec3(.19,.12,.59),n)*(.4+light*.65);col+=vec3(.12,.28,.95)*veins*.75;col+=mix(vec3(.46,.2,1.),vec3(.14,.5,1.),vP.y*.2+.5)*rim*1.65;gl_FragColor=vec4(col,1.);}`;
function Star() {
  const geometry = useMemo(() => {
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
      depth: 0.16,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.04,
      bevelSegments: 2,
      steps: 1,
    });
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation={[0, -0.2, 0]}>
      <meshStandardMaterial
        color="#b8a0ff"
        emissive="#6c37d9"
        emissiveIntensity={0.55}
        metalness={0.7}
        roughness={0.22}
      />
    </mesh>
  );
}
function World({
  pointer,
  run,
  onReady,
  mobile,
}: {
  pointer: RefObject<{ x: number; y: number; scroll: number }>;
  run?: AnimationRun;
  onReady: () => void;
  mobile: boolean;
}) {
  const group = useRef<Group>(null),
    planet = useRef<Mesh>(null),
    rings = useRef<Group>(null),
    star = useRef<Group>(null),
    globe = useRef<Group>(null),
    material = useRef<ShaderMaterial>(null),
    first = useRef(true);
  const points = useMemo(() => {
    let seed = 941;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return new Float32Array(
      Array.from(
        { length: (mobile ? 70 : 160) * 3 },
        () => (rand() - 0.5) * 15,
      ),
    );
  }, [mobile]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock, gl }, delta) => {
    const t = clock.elapsedTime,
      d = Math.min(delta, 0.05),
      v = pointer.current;
    if (first.current) {
      first.current = false;
      onReady();
    }
    if (material.current) material.current.uniforms.uTime.value = t;
    if (group.current) {
      group.current.rotation.y = MathUtils.damp(
        group.current.rotation.y,
        v.x * 0.13,
        5,
        d,
      );
      group.current.rotation.x = MathUtils.damp(
        group.current.rotation.x,
        v.y * 0.07,
        5,
        d,
      );
    }
    if (planet.current) planet.current.rotation.y = t * 0.045 + v.scroll * 0.35;
    if (rings.current) {
      rings.current.rotation.z = Math.sin(t * 0.18) * 0.1 + v.scroll * 0.2;
      rings.current.rotation.y = t * 0.035;
    }
    if (run) {
      const time = run.clock.time;
      const world =
        run.mode === "initial" ? MathUtils.smoothstep(time, 2.16, 2.8) : 0;
      if (globe.current) {
        globe.current.scale.setScalar(Math.max(0.001, world));
        globe.current.visible = world > 0.001;
      }
      if (star.current) {
        star.current.visible = world < 0.95;
        star.current.scale.setScalar(
          (run.mode === "initial"
            ? MathUtils.clamp((time - 0.35) / 0.65, 0.001, 1)
            : 1) *
            (1 - world * 0.9),
        );
        star.current.rotation.y = t * 0.35;
        star.current.position.x = run.clock.brand > 0 ? -0.85 : 0;
      }
      run.performance.frames++;
      run.performance.frameMs.push(delta * 1000);
      if (run.performance.frameMs.length > 360) run.performance.frameMs.shift();
      run.performance.drawCalls = gl.info.render.calls;
      run.performance.triangles = gl.info.render.triangles;
      run.performance.dpr = gl.getPixelRatio();
      run.performance.variant = mobile ? "cosmic-mobile" : "cosmic-desktop";
      run.performance.fallback = false;
    } else if (star.current) star.current.visible = false;
  });
  return (
    <group ref={group}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[-3, 4, 5]} color="#d2baff" intensity={4} />
      <pointLight position={[2, -1, 3]} color="#22d3ee" intensity={10} />
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#bdadff"
          size={0.018}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </points>
      <group ref={globe}>
        <mesh ref={planet}>
          <sphereGeometry args={[1.9, mobile ? 48 : 72, mobile ? 32 : 48]} />
          <shaderMaterial
            ref={material}
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
        <group ref={rings}>
          {[
            [-0.82, 0.28, 0.22],
            [-1.13, -0.4, -0.36],
            [-0.55, 0.25, 0.6],
          ].map((r, i) => (
            <group key={i} rotation={r as [number, number, number]}>
              <mesh>
                <torusGeometry
                  args={[2.65 + i * 0.17, i === 0 ? 0.012 : 0.006, 6, 144]}
                />
                <meshBasicMaterial
                  color={i === 1 ? "#64bfff" : "#b67aff"}
                  transparent
                  opacity={i === 0 ? 0.9 : 0.6}
                />
              </mesh>
              <mesh position={[2.65 + i * 0.17, 0, 0]}>
                <sphereGeometry args={[0.055, 12, 10]} />
                <meshBasicMaterial color={i === 1 ? "#b0f0ff" : "#e0aaff"} />
              </mesh>
              <mesh position={[-2.65 - i * 0.17, 0, 0]}>
                <sphereGeometry args={[0.03, 8, 6]} />
                <meshBasicMaterial color="#a855f7" />
              </mesh>
            </group>
          ))}
        </group>
      </group>
      <group ref={star} scale={run ? 1 : 0}>
        <Star />
        <group rotation={[1.1, 0.3, 0]}>
          <mesh>
            <torusGeometry args={[1.55, 0.016, 6, 96]} />
            <meshBasicMaterial color="#a855f7" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
export default function CosmicScene(props: {
  pointer: RefObject<{ x: number; y: number; scroll: number }>;
  run?: AnimationRun;
  onReady: () => void;
  mobile: boolean;
}) {
  return (
    <Canvas
      dpr={[1, props.mobile ? 1.25 : 1.5]}
      camera={{ position: [0, 0.1, props.mobile ? 7.5 : 8.3], fov: 43 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
    >
      <World {...props} />
    </Canvas>
  );
}
