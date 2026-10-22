"use client";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { hotelBySlug } from "@/data/hotels-resorts";
import type { BrandOverlayProps } from "@/components/brand-animations/types";
export default function HotelLoader({
  run,
  onTimeline,
  onFinishGate,
  onComplete,
  onSkip,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const hotel = hotelBySlug(run.hotel!)!;
  const refresh = run.mode === "refresh";
  useLayoutEffect(() => {
    if (!root.current) return;
    const el = root.current,
      q = gsap.utils.selector(el),
      duration = refresh ? hotel.refreshDuration : hotel.initialDuration;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        el.dataset.animationStage = String(
          Math.min(3, Math.floor((run.clock.time / duration) * 4)),
        );
      },
    });
    tl.to(run.clock, { time: duration, duration, ease: "none" }, 0);
    gsap.set(q(".hotel-loader-line"), {
      strokeDasharray: 1500,
      strokeDashoffset: 1500,
    });
    tl.to(
      q(".hotel-loader-line"),
      {
        strokeDashoffset: 0,
        duration: duration * 0.7,
        stagger: 0.03,
        ease: "power2.inOut",
      },
      0,
    );
    tl.fromTo(
      q(".hotel-loader-orbit"),
      { scale: refresh ? 0.7 : 0.2, rotation: -25, opacity: 0 },
      {
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: duration * 0.6,
        stagger: 0.04,
        transformOrigin: "50% 50%",
      },
      0,
    );
    tl.fromTo(
      q(".hotel-loader-light"),
      { opacity: 0 },
      { opacity: 1, stagger: 0.03, duration: duration * 0.3 },
      duration * 0.2,
    );
    tl.fromTo(
      q(".hotel-loader-name,.hotel-loader-tagline"),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, stagger: 0.07, duration: duration * 0.25 },
      duration * 0.35,
    );
    tl.fromTo(
      q(".hotel-loader-progress"),
      { scaleX: 0 },
      { scaleX: 1, duration: duration * 0.85, ease: "none" },
      0,
    );
    tl.to(
      q(".hotel-loader-scenery"),
      { scale: 1, opacity: refresh ? 0 : 0.3, duration: duration * 0.85 },
      0,
    );
    tl.addPause(duration - 0.15, () => onFinishGate(run.key));
    if (refresh && hotel.slug === "luxury-hotel")
      tl.to(
        q(".hotel-loader-door"),
        { xPercent: (i) => (i % 2 ? 100 : -100), duration: 0.2 },
        duration - 0.25,
      );
    tl.to(el, { opacity: 0, duration: 0.15 }, duration - 0.15);
    onTimeline(run.key, tl);
    return () => {
      tl.kill();
    };
  }, [run, hotel, onTimeline, onFinishGate, onComplete, refresh]);
  return (
    <div
      ref={root}
      className={`hotel-loader hotel-loader-${hotel.slug} ${refresh ? "hotel-loader-refresh" : "hotel-loader-initial"}`}
      data-animation-mode={run.mode}
      data-animation-template={hotel.slug}
      data-animation-stage="0"
      aria-label={`${hotel.name} ${refresh ? "refresh" : "introduction"}`}
      style={
        {
          "--hotel-bg": hotel.palette.bg,
          "--hotel-ink": hotel.palette.ink,
        } as React.CSSProperties
      }
    >
      <div
        className="hotel-loader-scenery"
        style={{ backgroundImage: `url(${hotel.hero})` }}
      />
      <div className="hotel-loader-core">
        <svg viewBox="0 0 400 280" aria-hidden="true">
          {hotel.slug === "resort-paradise" ? (
            <>
              <circle
                className="hotel-loader-orbit"
                cx="200"
                cy="105"
                r={refresh ? 52 : 65}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              {[0, 1, 2].map((i) => (
                <ellipse
                  className="hotel-loader-orbit"
                  key={i}
                  cx="200"
                  cy={180 + i * 16}
                  rx={90 + i * 35}
                  ry={12 + i * 4}
                  fill="none"
                  stroke="currentColor"
                  opacity={0.8 - i * 0.2}
                />
              ))}
              {!refresh && (
                <path
                  className="hotel-loader-line"
                  d="M80 180 Q90 100 70 55 M70 55 Q20 20 15 65 M70 55 Q90 10 125 40 M70 55 Q30 30 30 90 M70 55 Q130 30 140 80"
                  fill="none"
                  stroke="currentColor"
                />
              )}
            </>
          ) : hotel.slug === "luxury-hotel" ? (
            <>
              <path
                className="hotel-loader-line"
                d={
                  refresh
                    ? "M110 50H290V240H110ZM200 50V240"
                    : "M80 240V100H140V40H260V100H320V240M140 240V40M260 40V240"
                }
                fill="none"
                stroke="currentColor"
              />
              {!refresh &&
                Array.from({ length: 18 }, (_, i) => (
                  <rect
                    className="hotel-loader-light"
                    key={i}
                    x={155 + (i % 3) * 35}
                    y={60 + Math.floor(i / 3) * 28}
                    width="16"
                    height="12"
                    fill="currentColor"
                    opacity=".6"
                  />
                ))}
              {refresh && (
                <>
                  <rect
                    className="hotel-loader-door"
                    x="111"
                    y="51"
                    width="89"
                    height="188"
                    fill="#1e1c17"
                  />
                  <rect
                    className="hotel-loader-door"
                    x="200"
                    y="51"
                    width="89"
                    height="188"
                    fill="#1e1c17"
                  />
                </>
              )}
            </>
          ) : hotel.slug === "mountain-retreat" ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <path
                  className="hotel-loader-line"
                  key={i}
                  d={`M20 ${230 - i * 16} Q70 ${190 - i * 20} 115 ${110 - i * 15} Q145 ${180 - i * 22} 175 ${130 - i * 15} L230 ${45 + i * 8} Q285 ${180 - i * 18} 380 ${215 - i * 12}`}
                  fill="none"
                  stroke="currentColor"
                  opacity={0.4 + i * 0.15}
                />
              ))}
              {!refresh && (
                <>
                  <path
                    className="hotel-loader-line"
                    d="M150 230V195L185 165L220 195V230M140 198L185 155L230 198"
                    fill="none"
                    stroke="currentColor"
                  />
                  <rect
                    className="hotel-loader-light"
                    x="178"
                    y="203"
                    width="17"
                    height="24"
                    fill="#bd8d51"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <circle
                className="hotel-loader-orbit"
                cx="200"
                cy="90"
                r={refresh ? 40 : 57}
                fill="none"
                stroke="currentColor"
              />
              {[0, 1, 2, 3].map((i) => (
                <path
                  className="hotel-loader-line"
                  key={i}
                  d={`M20 ${165 + i * 22} Q75 ${140 + i * 22} 130 ${165 + i * 22} T240 ${165 + i * 22} T380 ${165 + i * 22}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={i === 0 ? 2 : 1}
                />
              ))}
              {!refresh && (
                <path
                  className="hotel-loader-line"
                  d="M290 170V135L320 110L350 135V170M280 140L320 105L360 140"
                  fill="none"
                  stroke="currentColor"
                />
              )}
            </>
          )}
          {refresh && (
            <text
              className="hotel-loader-light"
              x="200"
              y="145"
              textAnchor="middle"
              fill="currentColor"
              fontFamily="Georgia"
              fontSize="35"
            >
              {hotel.monogram}
            </text>
          )}
        </svg>
        <div className="hotel-loader-name">{hotel.name}</div>
        <p className="hotel-loader-tagline">
          {refresh ? "Welcome back" : hotel.concept}
        </p>
        <div className="hotel-loader-progress" />
      </div>
      <button className="animation-skip" onClick={onSkip}>
        Skip introduction ↗
      </button>
    </div>
  );
}
