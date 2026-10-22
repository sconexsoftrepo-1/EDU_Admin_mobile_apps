"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { CompanionBoundary } from "./footer/DeveloperFooter";
const Scene = dynamic(() => import("./footer/AICompanionScene"), {
  ssr: false,
});
export default function HeroCompanion() {
  const root = useRef<HTMLButtonElement>(null),
    pointer = useRef({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false),
    [webgl, setWebgl] = useState(false),
    [ready, setReady] = useState(false),
    [happy, setHappy] = useState(false);
  const reduced = useReducedMotion();
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (!e.isIntersecting) {
          setReady(false);
          return;
        }
        try {
          const gl = document.createElement("canvas").getContext("webgl2");
          setWebgl(Boolean(gl));
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {}
      },
      { rootMargin: "30px" },
    );
    if (root.current) obs.observe(root.current);
    return () => obs.disconnect();
  }, []);
  return (
    <button
      ref={root}
      className={`hero-companion ${ready && visible && webgl && !reduced ? "is-ready" : ""}`}
      aria-label="Interact with the 3D universe companion"
      aria-pressed={happy}
      onClick={() => setHappy(!happy)}
      onPointerMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: ((e.clientX - b.left) / b.width) * 2 - 1,
          y: ((e.clientY - b.top) / b.height) * 2 - 1,
        };
      }}
    >
      <Image
        unoptimized
        src="/assets/showcase/creator/companion-fallback.webp"
        alt=""
        fill
        sizes="110px"
      />
      {visible && webgl && !reduced && (
        <CompanionBoundary onError={() => setWebgl(false)}>
          <Scene
            mood={happy ? "happy" : "curious"}
            pointer={pointer}
            onReady={onReady}
          />
        </CompanionBoundary>
      )}
      <span>{happy ? "Hello, explorer!" : "Move. Tap. Explore."}</span>
    </button>
  );
}
