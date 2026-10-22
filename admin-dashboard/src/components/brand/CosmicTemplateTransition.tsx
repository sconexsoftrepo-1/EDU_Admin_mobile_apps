"use client";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowRight } from "lucide-react";
import { restaurantBySlug } from "@/data/restaurants";
import { schoolBySlug } from "@/data/education";
import { hotelBySlug } from "@/data/hotels-resorts";
import { templates } from "@/data/clinic";
import { brandConfig } from "./config/brandConfig";
import type { BrandOverlayProps } from "../brand-animations/types";
export default function CosmicTemplateTransition({
  run,
  onTimeline,
  onCovered,
  onComplete,
  onSkip,
}: BrandOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const hotel = run.hotel ? hotelBySlug(run.hotel) : undefined;
  const school = run.school ? schoolBySlug(run.school) : undefined;
  const restaurant = run.restaurant
    ? restaurantBySlug(run.restaurant)
    : undefined;
  const template = restaurant
    ? { name: restaurant.name, color: restaurant.colors.accent }
    : school
      ? { name: school.name, color: school.colors.accent }
      : hotel
        ? { name: hotel.name, color: hotel.palette.accent }
        : templates.find((t) => t.id === run.templateId)!;
  const preview = restaurant
    ? `/assets/restaurants-food/previews/${restaurant.slug}-desktop.webp`
    : school
      ? `/assets/education-schools/previews/${school.slug}-desktop.webp`
      : hotel
        ? `/assets/hotels-resorts/previews/${hotel.slug}-desktop.webp`
        : `/assets/showcase/previews/${run.templateId}-desktop.webp`;
  useLayoutEffect(() => {
    if (!root.current) return;
    const el = root.current,
      q = gsap.utils.selector(el);
    const duration = run.reduced ? 0.16 : 0.7;
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => onComplete(run.key),
      onUpdate: () => {
        el.dataset.animationStage = String(
          run.clock.time < 0.2
            ? 0
            : run.clock.time < 0.4
              ? 1
              : run.clock.time < 0.6
                ? 2
                : 3,
        );
      },
    });
    tl.to(run.clock, { time: duration, duration, ease: "none" }, 0);
    if (run.reduced) {
      gsap.set(q("[data-surface]"), { clipPath: "inset(0 0 0 0)" });
      tl.addPause(0.05, () => onCovered(run.key));
      tl.to(el, { opacity: 0, duration: 0.11 }, 0.05);
    } else {
      gsap.set(q("[data-surface]"), {
        clipPath: `circle(0% at ${run.origin.x}% ${run.origin.y}%)`,
      });
      tl.to(
        q("[data-surface]"),
        {
          clipPath: `circle(150% at ${run.origin.x}% ${run.origin.y}%)`,
          duration: 0.34,
          ease: "power2.inOut",
        },
        0,
      );
      tl.fromTo(
        q(".cosmic-switch-grid"),
        { scale: 0.2, opacity: 1 },
        { scale: 2.5, opacity: 0, duration: 0.32 },
        0,
      );
      tl.fromTo(
        q(".cosmic-energy-streak"),
        { xPercent: -130, opacity: 0 },
        { xPercent: 100, opacity: 1, duration: 0.4 },
        0.12,
      );
      tl.addPause(0.4, () => onCovered(run.key));
      tl.fromTo(
        q(".cosmic-destination-preview"),
        { opacity: 0, scale: 0.7, rotateY: -20 },
        { opacity: 1, scale: 1, rotateY: 0, duration: 0.2, ease: "power2.out" },
        0.4,
      );
      tl.to(
        q(".cosmic-destination-preview"),
        { scale: 1.07, duration: 0.1 },
        0.6,
      );
      tl.to(el, { opacity: 0, duration: 0.1 }, 0.6);
    }
    onTimeline(run.key, tl);
    return () => {
      tl.kill();
    };
  }, [run, onTimeline, onCovered, onComplete]);
  return (
    <div
      ref={root}
      className="animation-overlay cosmic-overlay cosmic-overlay-switch route-transition"
      data-animation-mode="switch"
      data-animation-template={run.templateId}
      data-animation-stage="0"
      aria-label={`${brandConfig.wordmark} template transition`}
      style={{ background: "transparent" }}
    >
      <div
        className="cosmic-overlay-surface"
        data-surface
        data-animation-surface
      >
        <div className="cosmic-overlay-sky" />
        <div
          className="cosmic-switch-grid"
          style={{ left: `${run.origin.x}%`, top: `${run.origin.y}%` }}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div
          className="cosmic-destination-preview"
          style={
            { "--destination-accent": template.color } as React.CSSProperties
          }
        >
          <span>{template.name}</span>
          <Image
            unoptimized
            src={preview}
            width={1440}
            height={1000}
            alt={`${template.name} destination preview`}
            priority
          />
        </div>
        <div className="cosmic-energy-streak" />
      </div>
      <button className="animation-skip" onClick={onSkip}>
        Continue to template
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
