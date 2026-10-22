"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useReducedMotion } from "motion/react";
import { CompanionBoundary } from "../showcase/footer/DeveloperFooter";
import type { AnimationRun } from "../animation-system/config/animationRegistry";
const Scene = dynamic(() => import("./CosmicScene"), { ssr: false });
export default function CosmicEnvironment({
  pointer,
  run,
}: {
  pointer: RefObject<{ x: number; y: number; scroll: number }>;
  run?: AnimationRun;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false),
    [webgl, setWebgl] = useState(false),
    [ready, setReady] = useState(false),
    [mobile, setMobile] = useState(false);
  const reduced = useReducedMotion();
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const mq = matchMedia("(max-width:700px)");
    const update = () => setMobile(mq.matches);
    const obs = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (!e.isIntersecting) {
          setReady(false);
          return;
        }
        update();
        try {
          const gl = document.createElement("canvas").getContext("webgl2");
          setWebgl(Boolean(gl));
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          setWebgl(false);
        }
      },
      { rootMargin: "80px" },
    );
    if (root.current) obs.observe(root.current);
    mq.addEventListener("change", update);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", update);
    };
  }, []);
  return (
    <div
      ref={root}
      className={`cosmic-environment ${ready && visible && !reduced ? "is-rendered" : ""}`}
      aria-hidden="true"
    >
      <Image
        unoptimized
        className="cosmic-planet-fallback"
        src={
          run
            ? "/assets/brand/logos/brand-star.webp"
            : "/assets/brand/fallbacks/planet.webp"
        }
        fill
        sizes="(max-width:700px) 100vw, 70vw"
        alt=""
        priority
      />
      {visible && webgl && !reduced && (
        <CompanionBoundary
          onError={() => {
            setWebgl(false);
            setReady(false);
          }}
        >
          <Scene
            pointer={pointer}
            run={run}
            onReady={onReady}
            mobile={mobile}
          />
        </CompanionBoundary>
      )}
    </div>
  );
}
