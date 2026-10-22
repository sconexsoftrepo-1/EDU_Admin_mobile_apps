"use client";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { brandConfig as brand } from "../brand/config/brandConfig";
import type { BrandOverlayProps } from "./types";
/** An independent SVG/DOM technical stage. No cosmic Canvas or environment is imported. */
export default function RefreshSignatureIntro({
  run,
  onTimeline,
  onFinishGate,
  onComplete,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    const el = root.current,
      q = gsap.utils.selector(el);
    let previous = -1;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        const time = run.clock.time,
          stage = time < 0.55 ? 0 : time < 1.45 ? 1 : 2;
        if (stage !== previous) {
          previous = stage;
          el.dataset.animationStage = String(stage);
        }
      },
    });
    tl.to(run.clock, { time: 2.2, duration: 2.2, ease: "none" }, 0);
    gsap.set(q(".refresh-draw-ring"), {
      strokeDasharray: 1000,
      strokeDashoffset: 1000,
    });
    gsap.set(q(".refresh-kc-lit"), {
      clipPath: "inset(0 100% 0 0)",
      opacity: 0.2,
    });
    gsap.set(q(".refresh-signature"), { opacity: 0, y: 8 });
    gsap.set(q(".refresh-marker"), { opacity: 0 });
    tl.to(
      q(".refresh-draw-ring"),
      { strokeDashoffset: 0, duration: 0.55, ease: "power2.out" },
      0,
    );
    tl.to(
      q(".refresh-marker"),
      { opacity: 1, stagger: 0.06, duration: 0.18 },
      0.1,
    );
    tl.to(
      q(".refresh-scanning-arc"),
      {
        rotation: 360,
        svgOrigin: "200 200",
        duration: 1.45,
        ease: "none",
      },
      0,
    );
    tl.to(
      q(".refresh-kc-lit"),
      {
        clipPath: "inset(0 0% 0 0)",
        opacity: 1,
        duration: 0.65,
        ease: "power2.inOut",
      },
      0.55,
    );
    tl.fromTo(
      q(".refresh-light-sweep"),
      { xPercent: -150, opacity: 0 },
      { xPercent: 150, opacity: 1, duration: 0.7 },
      0.55,
    );
    tl.to(q(".refresh-signature"), { opacity: 1, y: 0, duration: 0.35 }, 0.85);
    tl.addPause(1.45, () => onFinishGate(run.key));
    tl.to(
      q(".refresh-scanner-center"),
      { scale: 0.85, opacity: 0, duration: 0.45, ease: "power2.in" },
      1.45,
    );
    tl.to(q(".refresh-technical-grid"), { opacity: 0, duration: 0.3 }, 1.45);
    tl.to(
      q(".refresh-shutter-panel"),
      {
        x: (i) => Math.cos((i * Math.PI) / 4 + Math.PI / 8) * innerWidth * 0.95,
        y: (i) =>
          Math.sin((i * Math.PI) / 4 + Math.PI / 8) * innerHeight * 0.95,
        rotation: (i) => (i % 2 ? 9 : -9),
        duration: 0.75,
        ease: "power3.inOut",
      },
      1.45,
    );
    tl.to(el, { opacity: 0, duration: 0.1 }, 2.1);
    run.performance.variant = "refresh-svg-scanner";
    run.performance.fallback = false;
    run.startedAt = performance.now();
    onTimeline(run.key, tl);
    return () => {
      tl.kill();
    };
  }, [run, onTimeline, onFinishGate, onComplete]);
  return (
    <div
      ref={root}
      className="animation-overlay kc-refresh-intro"
      data-animation-mode="refresh"
      data-animation-template={run.templateId}
      data-animation-stage="0"
      aria-label={`${brand.wordmark} digital signature refresh`}
    >
      <div className="refresh-shutter" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i
            key={i}
            className="refresh-shutter-panel"
            style={{
              clipPath: `polygon(50% 50%,${50 + Math.cos((i * Math.PI) / 4) * 100}% ${50 + Math.sin((i * Math.PI) / 4) * 100}%,${50 + Math.cos(((i + 1) * Math.PI) / 4) * 100}% ${50 + Math.sin(((i + 1) * Math.PI) / 4) * 100}%)`,
            }}
          />
        ))}
      </div>
      <div className="refresh-technical-grid" />
      <div className="refresh-scanner-center">
        <div className="refresh-scanner">
          <Image
            unoptimized
            src="/assets/animations/refresh/textures/scanner-rings.svg"
            fill
            alt=""
            sizes="380px"
          />
          <svg viewBox="0 0 400 400" aria-hidden="true">
            <circle
              className="refresh-draw-ring"
              cx="200"
              cy="200"
              r="159"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="1"
            />
            <g className="refresh-scanning-arc">
              <path
                d="M200 41A159 159 0 0 1 359 200"
                stroke="#a9cfff"
                strokeWidth="3"
                fill="none"
              />
              <circle cx="359" cy="200" r="4" fill="#dcfaff" />
            </g>
            {[
              [200, 28],
              [372, 200],
              [200, 372],
              [28, 200],
            ].map(([cx, cy], i) => (
              <rect
                className="refresh-marker"
                key={i}
                x={cx - 3}
                y={cy - 3}
                width="6"
                height="6"
                fill="#b688ff"
              />
            ))}
          </svg>
          <div className="refresh-kc">
            <Image
              unoptimized
              src="/assets/animations/refresh/fallbacks/kc-chrome.svg"
              width={280}
              height={180}
              alt={`${brand.monogram} metallic monogram`}
              priority
            />
            <Image
              unoptimized
              className="refresh-kc-lit"
              src="/assets/animations/refresh/fallbacks/kc-signature.svg"
              width={280}
              height={180}
              alt=""
              priority
            />
            <div className="refresh-light-sweep" />
          </div>
        </div>
        <div className="refresh-signature">
          <p>{brand.developer.toUpperCase()}</p>
          <span>{brand.tagline}</span>
        </div>
      </div>
    </div>
  );
}
