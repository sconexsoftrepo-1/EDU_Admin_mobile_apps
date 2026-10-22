"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowRight } from "lucide-react";
import { BrandStar } from "../brand/BrandLogo";
import {
  brandConfig as brand,
  brandAnimationConfig,
} from "../brand/config/brandConfig";
import { CompanionBoundary } from "../showcase/footer/DeveloperFooter";
import type { BrandOverlayProps } from "./types";
const Scene = dynamic(() => import("./InitialCosmicScene"), { ssr: false });
export default function InitialCosmicIntro({
  run,
  onTimeline,
  onFinishGate,
  onComplete,
  onSkip,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null),
    [webgl, setWebgl] = useState(false),
    [ready, setReady] = useState(false),
    [mobile, setMobile] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  useLayoutEffect(() => {
    if (!root.current) return;
    const el = root.current,
      q = gsap.utils.selector(el);
    let last = -1;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        let stage = 0;
        brandAnimationConfig.initial.stages.forEach((time, i) => {
          if (run.clock.time >= time) stage = i;
        });
        if (stage !== last) {
          last = stage;
          el.dataset.animationStage = String(stage);
        }
      },
    });
    tl.to(run.clock, { time: 6, duration: 6, ease: "none" }, 0);
    gsap.set(q("[data-initial-identity]"), { opacity: 0 });
    gsap.set(q(".initial-nebula"), { opacity: 0, scale: 1.1 });
    gsap.set(q(".initial-tunnel"), { opacity: 0, scale: 0.3, rotation: -50 });
    gsap.set(q(".initial-kc-fallback"), { opacity: 0, scale: 0.3 });
    gsap.set(q(".initial-horizon"), { opacity: 0 });
    gsap.set(q(".initial-world-environment"), { opacity: 0 });
    gsap.set(q(".initial-world-fallback"), { opacity: 0, scale: 0.2 });
    tl.to(q(".initial-nebula"), { opacity: 0.28, duration: 0.8 }, 0);
    tl.fromTo(
      q(".initial-ignition"),
      { scale: 0.1, opacity: 0 },
      { scale: 1.3, opacity: 1, duration: 0.6 },
      0,
    );
    tl.fromTo(
      q(".initial-light-streak"),
      { xPercent: -120, opacity: 0 },
      { xPercent: 120, opacity: 1, duration: 0.8, ease: "power2.inOut" },
      0,
    );
    tl.to(
      q(".initial-nebula"),
      { opacity: 0.68, scale: 1.32, duration: 1, ease: "power2.in" },
      0.8,
    );
    tl.to(
      q(".initial-tunnel"),
      {
        opacity: 1,
        scale: 1.6,
        rotation: 130,
        duration: 1.0,
        ease: "power2.in",
      },
      0.8,
    );
    tl.to(
      q(".initial-tunnel"),
      {
        scale: 0.5,
        opacity: 0.2,
        rotation: 220,
        duration: 1.1,
        ease: "power3.out",
      },
      1.8,
    );
    tl.to(
      q(".initial-kc-fallback"),
      { opacity: 1, scale: 1, duration: 1.1, ease: "power3.out" },
      1.8,
    );
    tl.fromTo(
      q("[data-initial-identity] span"),
      { opacity: 0, y: 15, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.035, duration: 0.32 },
      2.9,
    );
    tl.to(q("[data-initial-identity]"), { opacity: 1, duration: 0.2 }, 2.9);
    tl.fromTo(
      q(".initial-tagline"),
      { opacity: 0, letterSpacing: ".08em", y: 8 },
      { opacity: 1, letterSpacing: ".25em", y: 0, duration: 0.6 },
      3.1,
    );
    tl.to(
      q(".initial-nebula"),
      { opacity: 1, scale: 1, duration: 1.2, ease: "power2.inOut" },
      4,
    );
    tl.to(q(".initial-world-environment"), { opacity: 1, duration: 1.2 }, 4);
    tl.to(q(".initial-horizon"), { opacity: 1, duration: 1.2 }, 4);
    tl.to(
      q(".initial-world-fallback"),
      { opacity: 1, scale: 1, duration: 1.2 },
      4,
    );
    tl.to(
      q(".initial-kc-fallback"),
      { opacity: 0, scale: 0.35, yPercent: -80, duration: 0.7 },
      4,
    );
    tl.to(
      q("[data-initial-identity]"),
      { opacity: 0, y: -35, duration: 0.7 },
      4,
    );
    tl.to(q(".initial-tunnel"), { opacity: 0, duration: 0.5 }, 4);
    tl.fromTo(
      q(".initial-orbit-exit"),
      { scale: 0.15, opacity: 0 },
      { scale: 2.5, opacity: 0.85, duration: 0.65, ease: "power2.in" },
      5.2,
    );
    tl.to(q(".initial-orbit-exit"), { opacity: 0, duration: 0.2 }, 5.8);
    tl.addPause(5.2, () => onFinishGate(run.key));
    tl.to(el, { opacity: 0, duration: 0.2, ease: "power2.inOut" }, 5.8);
    let cancelled = false,
      attached = false;
    const attach = () => {
      if (cancelled || attached) return;
      attached = true;
      run.startedAt = performance.now();
      setMobile(innerWidth < 701);
      try {
        const gl = document.createElement("canvas").getContext("webgl2");
        setWebgl(Boolean(gl));
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {}
      onTimeline(run.key, tl);
    };
    const image = new window.Image();
    image.src =
      innerWidth < 701
        ? "/assets/animations/initial/backgrounds/nebula-mobile.webp"
        : "/assets/animations/initial/backgrounds/nebula.webp";
    const timeout = setTimeout(attach, 650);
    image
      .decode()
      .catch(() => {})
      .then(() => {
        clearTimeout(timeout);
        attach();
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      tl.kill();
    };
  }, [run, onTimeline, onFinishGate, onComplete]);
  return (
    <div
      ref={root}
      className={`animation-overlay kc-initial-intro ${ready ? "initial-scene-ready" : ""}`}
      data-animation-mode="initial"
      data-animation-template={run.templateId}
      data-animation-stage="0"
      aria-label={`${brand.wordmark} cosmic introduction`}
    >
      <div data-animation-surface className="initial-surface">
        <div className="initial-nebula" />
        <div className="initial-world-environment" />
        <div className="initial-ignition" />
        <div className="initial-light-streak" />
        <div className="initial-tunnel" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ "--tunnel-index": i } as React.CSSProperties} />
          ))}
        </div>
        <div className="initial-world-fallback">
          <Image
            unoptimized
            src="/assets/animations/initial/fallbacks/planet.webp"
            fill
            alt=""
            sizes="100vw"
          />
        </div>
        <div className="initial-kc-fallback" aria-hidden="true">
          <BrandStar />
          <Image
            unoptimized
            src="/assets/animations/initial/fallbacks/kc-cinematic.svg"
            width={400}
            height={258}
            alt=""
          />
        </div>
        {webgl && (
          <div className="initial-canvas" aria-hidden="true">
            <CompanionBoundary
              onError={() => {
                setWebgl(false);
                setReady(false);
              }}
            >
              <Scene run={run} mobile={mobile} onReady={onReady} />
            </CompanionBoundary>
          </div>
        )}
        <div className="initial-horizon" />
        <div className="initial-identity" data-initial-identity>
          <p aria-label={brand.developer}>
            {Array.from(brand.developer.toUpperCase()).map((c, i) => (
              <span key={i} aria-hidden="true">
                {c === " " ? "\u00a0" : c}
              </span>
            ))}
          </p>
          <p className="initial-tagline">{brand.tagline}</p>
        </div>
        <div className="initial-orbit-exit" />
      </div>
      <button className="animation-skip" onClick={onSkip}>
        Skip intro
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
