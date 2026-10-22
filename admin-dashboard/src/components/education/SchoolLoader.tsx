"use client";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { schoolBySlug } from "@/data/education";
import type { BrandOverlayProps } from "@/components/brand-animations/types";
export default function SchoolLoader({
  run,
  onTimeline,
  onFinishGate,
  onComplete,
  onSkip,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null),
    school = schoolBySlug(run.school!)!,
    refresh = run.mode === "refresh";
  useLayoutEffect(() => {
    if (!root.current) return;
    const el = root.current,
      q = gsap.utils.selector(el),
      d = refresh ? school.refreshDuration : school.initialDuration;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        el.dataset.animationStage = String(
          Math.min(4, Math.floor((run.clock.time / d) * 5)),
        );
      },
    });
    tl.to(run.clock, { time: d, duration: d, ease: "none" }, 0);
    tl.fromTo(
      q(".school-loader-progress"),
      { scaleX: 0 },
      { scaleX: 1, duration: d - 0.15, ease: "none" },
      0,
    );
    if (refresh) {
      if (school.slug === "little-sprouts")
        tl.fromTo(
          q(".school-loader-leaf"),
          { rotateY: -180, scale: 0.5 },
          {
            rotateY: 0,
            scale: 1,
            duration: d * 0.65,
            transformOrigin: "50% 50%",
            ease: "back.out(1.2)",
          },
          0,
        );
      if (school.slug === "sunrise-international")
        tl.fromTo(
          q(".school-loader-sweep"),
          { x: -250, opacity: 0 },
          { x: 250, opacity: 0.9, duration: d * 0.8, ease: "power2.inOut" },
          0,
        );
      if (school.slug === "maplewood-high")
        tl.fromTo(
          q(".school-loader-crest"),
          { scale: 0.75, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: d * 0.45,
            transformOrigin: "50% 50%",
          },
          0,
        );
      if (school.slug === "evergreen-global")
        tl.fromTo(
          q(".school-loader-crest"),
          { scale: 0.8, opacity: 0.2 },
          {
            scale: 1,
            opacity: 1,
            duration: d * 0.6,
            transformOrigin: "50% 50%",
          },
          0,
        );
      tl.to(
        q(".school-loader-curtain"),
        { scaleX: 0, duration: d * 0.3, stagger: 0.03 },
        d * 0.6,
      );
    } else {
      tl.fromTo(
        q(".school-loader-seed"),
        { scale: 0, y: 25 },
        { scale: 1, y: 0, duration: 0.4, transformOrigin: "50% 50%" },
        0,
      );
      gsap.set(q(".school-loader-draw"), {
        strokeDasharray: 1200,
        strokeDashoffset: 1200,
      });
      tl.to(
        q(".school-loader-draw"),
        {
          strokeDashoffset: 0,
          duration: d * 0.55,
          stagger: 0.07,
          ease: "power2.inOut",
        },
        0.2,
      );
      tl.fromTo(
        q(".school-loader-sunrise"),
        { y: 90, opacity: 0 },
        { y: 0, opacity: 1, duration: d * 0.5, ease: "power2.out" },
        0,
      );
      tl.fromTo(
        q(".school-loader-campus"),
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, duration: d * 0.3 },
        d * 0.38,
      );
      tl.fromTo(
        q(".school-loader-leaf"),
        { scale: 0 },
        {
          scale: 1,
          duration: d * 0.35,
          stagger: 0.06,
          transformOrigin: "50% 100%",
          ease: "back.out(1.3)",
        },
        0.55,
      );
      tl.to(
        q(".school-loader-backdrop"),
        { opacity: 0.18, scale: 1, duration: d * 0.4 },
        d * 0.5,
      );
    }
    tl.fromTo(
      q(".school-loader-name,.school-loader-tagline"),
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.06, duration: d * 0.25 },
      d * 0.3,
    );
    tl.addPause(d - 0.15, () => onFinishGate(run.key));
    tl.to(el, { opacity: 0, duration: 0.15 }, d - 0.15);
    onTimeline(run.key, tl);
    return () => {
      tl.kill();
    };
  }, [run, school, refresh, onTimeline, onFinishGate, onComplete]);
  const sprouts = school.slug === "little-sprouts",
    sunrise = school.slug === "sunrise-international",
    maple = school.slug === "maplewood-high";
  return (
    <div
      ref={root}
      className={`school-loader school-loader-${school.slug} ${refresh ? "school-loader-refresh" : "school-loader-initial"}`}
      data-animation-mode={run.mode}
      data-animation-template={school.slug}
      data-animation-stage="0"
      aria-label={`${school.name} ${refresh ? "refresh" : "introduction"}`}
      style={
        {
          "--school-bg": school.colors.bg,
          "--school-ink": school.colors.ink,
          "--school-accent": school.colors.accent,
          "--school-soft": school.colors.soft,
        } as React.CSSProperties
      }
    >
      {!refresh && (
        <div
          className="school-loader-backdrop"
          style={{ backgroundImage: `url(${school.hero})` }}
        />
      )}
      {refresh && (
        <>
          <div className="school-loader-curtain" />
          <div className="school-loader-curtain" />
        </>
      )}
      <div className="school-loader-core">
        <svg viewBox="0 0 400 260" aria-hidden="true">
          {sprouts ? (
            <>
              <ellipse
                className="school-loader-seed"
                cx="200"
                cy="210"
                rx="14"
                ry="10"
                fill="#bf9251"
              />
              {!refresh && (
                <path
                  className="school-loader-draw"
                  d="M200 210V108"
                  stroke="#4d986a"
                  strokeWidth="8"
                  fill="none"
                />
              )}
              <path
                className="school-loader-leaf"
                d="M200 145C115 145 105 60 120 55C185 50 212 100 200 145Z"
                fill="#68ad74"
              />
              <path
                className="school-loader-leaf"
                d="M200 118C196 65 251 43 281 60C285 112 245 145 200 118Z"
                fill="#8fc789"
              />
              {!refresh && (
                <g className="school-loader-campus">
                  <path
                    d="M70 227V197L100 175L130 197V227M280 227V197L310 175L340 197V227"
                    fill="#ffd46a"
                    stroke="#d65a65"
                    strokeWidth="3"
                  />
                  <circle cx="150" cy="217" r="8" fill="#e7b58b" />
                  <circle cx="260" cy="217" r="8" fill="#e7b58b" />
                </g>
              )}
            </>
          ) : sunrise ? (
            <>
              <path d="M30 180H370" stroke="#1554bd" strokeWidth="3" />
              <circle
                className={
                  refresh ? "school-loader-crest" : "school-loader-sunrise"
                }
                cx="200"
                cy="125"
                r="58"
                fill="#ffd35c"
              />
              {refresh ? (
                <path
                  className="school-loader-sweep"
                  d="M30 55L180 210"
                  stroke="#ffd35c"
                  strokeWidth="30"
                  opacity=".6"
                />
              ) : (
                <>
                  <path
                    className="school-loader-draw"
                    d="M200 23V48M110 55L130 77M290 55L270 77M62 125H90M310 125H338"
                    fill="none"
                    stroke="#efb744"
                    strokeWidth="5"
                  />
                  <path
                    className="school-loader-campus"
                    d="M90 213V162H150V142H250V162H310V213M150 162V213M250 162V213"
                    fill="#edf7fc"
                    stroke="#1554bd"
                    strokeWidth="3"
                  />
                </>
              )}
            </>
          ) : maple ? (
            <g className="school-loader-crest">
              <path
                className={refresh ? "" : "school-loader-draw"}
                d="M120 45L200 18L280 45V130Q280 190 200 235Q120 190 120 130Z"
                fill="#eef5fb"
                stroke="#102d56"
                strokeWidth="4"
              />
              <path
                className={refresh ? "" : "school-loader-draw"}
                d="M155 85L200 70L245 85V150L200 170L155 150ZM200 70V170M155 85L200 105L245 85"
                fill="none"
                stroke="#185bb6"
                strokeWidth="4"
              />
              {!refresh && (
                <path
                  className="school-loader-campus"
                  d="M55 225V180H105M295 225V180H345V225"
                  fill="none"
                  stroke="#247959"
                  strokeWidth="3"
                />
              )}
            </g>
          ) : (
            <g className="school-loader-crest">
              <circle
                className={refresh ? "" : "school-loader-draw"}
                cx="200"
                cy="130"
                r="102"
                fill="none"
                stroke="#b2904c"
                strokeWidth="3"
              />
              <ellipse
                className={refresh ? "" : "school-loader-draw"}
                cx="200"
                cy="130"
                rx="48"
                ry="85"
                fill="none"
                stroke="#174f3e"
                strokeWidth="2"
              />
              <path
                className={refresh ? "" : "school-loader-draw"}
                d="M115 100H285M115 160H285M200 45V215"
                fill="none"
                stroke="#174f3e"
                strokeWidth="2"
              />
              <path
                className="school-loader-leaf"
                d="M110 205C65 145 80 85 100 72M290 205C335 145 320 85 300 72"
                fill="none"
                stroke="#b2904c"
                strokeWidth="8"
              />
            </g>
          )}
        </svg>
        <div className="school-loader-name">{school.name}</div>
        <p className="school-loader-tagline">
          {refresh ? "Welcome back" : school.tagline}
        </p>
        <div className="school-loader-progress" />
      </div>
      <button className="animation-skip" onClick={onSkip}>
        Skip introduction ↗
      </button>
    </div>
  );
}
