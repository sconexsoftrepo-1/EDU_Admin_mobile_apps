"use client";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { restaurantBySlug } from "@/data/restaurants";
import type { BrandOverlayProps } from "@/components/brand-animations/types";
export default function RestaurantLoader({
  run,
  onTimeline,
  onFinishGate,
  onComplete,
  onSkip,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null),
    r = restaurantBySlug(run.restaurant!)!,
    refresh = run.mode === "refresh";
  useLayoutEffect(() => {
    if (!root.current) return;
    const q = gsap.utils.selector(root),
      d = refresh ? r.refreshDuration : r.initialDuration;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        if (root.current)
          root.current.dataset.animationStage = String(
            Math.min(4, Math.floor((run.clock.time / d) * 5)),
          );
      },
    });
    tl.to(run.clock, { time: d, duration: d, ease: "none" }, 0);
    tl.fromTo(
      q(".food-loader-mark"),
      { scale: refresh ? 0.7 : 0.35, rotate: refresh ? -15 : -35, opacity: 0 },
      {
        scale: 1,
        rotate: 0,
        opacity: 1,
        duration: d * 0.55,
        ease: "power3.out",
      },
      0,
    );
    if (!refresh) {
      tl.fromTo(
        q(".food-loader-dish"),
        { clipPath: "circle(0% at 50% 50%)", y: 35 },
        { clipPath: "circle(72% at 50% 50%)", y: 0, duration: d * 0.5 },
        0.2,
      );
      tl.fromTo(
        q(".food-loader-orbit i"),
        { rotate: 0, scale: 0.2, opacity: 0 },
        {
          rotate: r.slug === "spice-route" ? 230 : 90,
          scale: 1,
          opacity: 1,
          stagger: 0.06,
          duration: d * 0.5,
        },
        0,
      );
    } else
      tl.fromTo(
        q(".food-loader-sweep"),
        { scaleX: 0 },
        { scaleX: 1, duration: d * 0.65, ease: "power2.inOut" },
        0,
      );
    tl.fromTo(
      q(".food-loader-wordmark"),
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.35 },
      d * 0.42,
    );
    tl.fromTo(
      q(".food-loader-line"),
      { scaleX: 0 },
      { scaleX: 1, duration: d - 0.1, ease: "none" },
      0,
    );
    tl.addPause(d - 0.15, () => onFinishGate(run.key));
    tl.to(root.current, { opacity: 0, duration: 0.15 }, d - 0.15);
    onTimeline(run.key, tl);
    return () => {
      tl.kill();
    };
  }, [r, refresh, run, onTimeline, onComplete, onFinishGate]);
  return (
    <div
      ref={root}
      className={`food-loader food-loader-${r.slug} ${refresh ? "food-loader-refresh" : "food-loader-initial"}`}
      data-animation-mode={run.mode}
      data-animation-template={r.slug}
      data-animation-stage="0"
      style={
        {
          "--loader-bg": r.colors.bg,
          "--loader-ink": r.colors.ink,
          "--loader-accent": r.colors.accent,
        } as React.CSSProperties
      }
    >
      <div className="food-loader-sweep" />
      <div className="food-loader-orbit" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} style={{ "--loader-i": i } as React.CSSProperties} />
        ))}
      </div>
      <div className="food-loader-inner">
        {!refresh && (
          <Image
            unoptimized
            className="food-loader-dish"
            src={
              r.slug.includes("biryani")
                ? "/assets/restaurants-food/handi/open.webp"
                : r.menu[0].image
            }
            width={300}
            height={220}
            alt=""
          />
        )}
        <Image
          unoptimized
          className="food-loader-mark"
          src={r.logo}
          width={100}
          height={100}
          alt=""
        />
        <div className="food-loader-wordmark">
          <strong>{r.name}</strong>
          <span>{refresh ? "A quick welcome back" : r.tagline}</span>
        </div>
        <div className="food-loader-line" />
      </div>
      <button className="animation-skip" onClick={onSkip}>
        Skip introduction ↗
      </button>
    </div>
  );
}
