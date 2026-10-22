"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Restaurant } from "@/data/restaurants";
import { useLiveReducedMotion } from "@/components/showcase/hooks/useLiveReducedMotion";

const frames = ["open", "closed", "lifted"] as const;
const labels = ["Full of flavour", "Dum sealed", "The reveal"];
const chapterFrames = [0, 1, 2, 0, 0, 2, 0];
function mix(values: number[], p: number) {
  const t = Math.max(0, Math.min(values.length - 1.000001, p));
  const i = Math.floor(t);
  return values[i] + (values[i + 1] - values[i]) * (t - i);
}

/** A photographic scroll story: no WebGL or frame-by-frame model rendering. */
export default function HandiJourney({
  restaurant: r,
  persistent = false,
}: {
  restaurant: Restaurant;
  persistent?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useLiveReducedMotion();
  const path = usePathname();
  const active = !persistent || path === `/restaurants-food/${r.slug}`;
  const [view, setView] = useState<number | null>(null);

  useEffect(() => {
    const el = root.current;
    const visual = stage.current;
    if (!el || !visual || !active) return;
    gsap.registerPlugin(ScrollTrigger);
    const photos = [...visual.querySelectorAll<HTMLElement>(".handi-photo")];
    const chapters = persistent
      ? [...document.querySelectorAll<HTMLElement>(".food-chapter")]
      : [];
    const state = { progress: 0 };
    const paint = () => {
      const p = Math.min(6, Math.max(0, state.progress));
      const index = Math.min(5, Math.floor(p));
      const fraction = p - index;
      const first = chapterFrames[index];
      const next = chapterFrames[index + 1];
      photos.forEach((photo, i) => {
        const alpha =
          view !== null || reduced
            ? Number(i === (view ?? 0))
            : Number(i === first) * (1 - fraction) +
              Number(i === next) * fraction;
        photo.style.opacity = String(alpha);
      });
      el.dataset.storyProgress = (p / 6).toFixed(4);
      el.dataset.view = frames[view ?? chapterFrames[Math.round(p)]];
      const mobile = innerWidth <= 700;
      if (persistent && chapters.length) {
        const chapter = chapters[Math.min(chapters.length - 1, Math.round(p))];
        const slot = chapter.querySelector<HTMLElement>(".food-scene-slot");
        const box = slot?.getBoundingClientRect();
        const inStory =
          chapters[0].getBoundingClientRect().top < innerHeight &&
          chapters.at(-1)!.getBoundingClientRect().bottom > 80;
        el.style.visibility =
          inStory &&
          (!mobile || (!!box && box.top < innerHeight && box.bottom > 80))
            ? "visible"
            : "hidden";
        if (mobile && box) {
          Object.assign(el.style, {
            top: `${box.top}px`,
            left: `${box.left}px`,
            right: "auto",
            width: `${box.width}px`,
            transform: "none",
            opacity: "1",
          });
        } else {
          const x = mix(
            [0, -105, 0, 0, -105, 0, 0],
            reduced ? Math.round(p) : p,
          );
          const scale = reduced
            ? 1
            : mix([1, 0.9, 1.03, 0.62, 0.88, 0.92, 1], p);
          Object.assign(el.style, {
            top: "15vh",
            left: "auto",
            right: "4vw",
            width: "44vw",
            transform: `translateX(${x}%) scale(${scale})`,
            opacity: String(mix([1, 1, 1, 0.08, 1, 1, 1], p)),
          });
          el.style.pointerEvents = p > 2.7 && p < 3.3 ? "none" : "auto";
        }
      }
      visual.style.setProperty(
        "--handi-turn",
        `${reduced ? 0 : mix([-4, 3, -2, 2, -3, 2, -1], p)}deg`,
      );
      visual.style.setProperty(
        "--handi-zoom",
        String(reduced ? 1 : mix([1, 0.96, 1.02, 0.96, 1.08, 0.98, 1], p)),
      );
    };
    const update = () => {
      if (!chapters.length) {
        paint();
        return;
      }
      const positions = chapters.map(
        (c) => c.getBoundingClientRect().top + scrollY,
      );
      const travel = scrollY + innerHeight * 0.18;
      let index = 0;
      while (index < positions.length - 1 && travel >= positions[index + 1])
        index++;
      const local =
        index === positions.length - 1
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                (travel - positions[index]) /
                  (positions[index + 1] - positions[index]),
              ),
            );
      const target = Math.min(6, index + local * local * (3 - 2 * local));
      gsap.to(state, {
        progress: target,
        duration: reduced ? 0 : 0.32,
        ease: "power2.out",
        overwrite: true,
        onUpdate: paint,
      });
      paint();
    };
    const trigger = ScrollTrigger.create({
      trigger: persistent ? document.querySelector(".food-home") : el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: update,
    });
    update();
    addEventListener("resize", update);
    return () => {
      trigger.kill();
      gsap.killTweensOf(state);
      removeEventListener("resize", update);
    };
  }, [active, persistent, reduced, view, path]);

  return (
    <section
      ref={root}
      className={`handi-journey ${persistent ? "handi-persistent" : "handi-inline"}`}
      data-active={active}
      data-ready="true"
      aria-hidden={!active}
      inert={!active}
      aria-label={`${r.name} photographic handi experience`}
    >
      <div className="handi-orbit" aria-hidden="true" />
      <div
        ref={stage}
        className="handi-photo-stage"
        tabIndex={0}
        role="group"
        aria-label="Biryani handi views. Use left and right arrow keys to change the image."
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            setView((v) => ((v ?? 0) + (e.key === "ArrowRight" ? 1 : 2)) % 3);
          }
        }}
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== "mouse") return;
          const b = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty(
            "--handi-tilt",
            `${((e.clientX - b.left - b.width / 2) / b.width) * 8}deg`,
          );
        }}
        onPointerLeave={(e) =>
          e.currentTarget.style.setProperty("--handi-tilt", "0deg")
        }
      >
        {frames.map((frame, i) => (
          <Image
            unoptimized
            key={frame}
            className={`handi-photo handi-photo-${frame}`}
            src={`/assets/restaurants-food/handi/${frame}.webp`}
            width={960}
            height={1088}
            loading={persistent ? "eager" : "lazy"}
            alt={
              i === 0
                ? "Realistic copper handi filled with saffron basmati biryani, chicken, fried onions and mint"
                : ""
            }
            aria-hidden={i !== 0}
            style={{ opacity: i === 0 ? 1 : 0 }}
            sizes="(max-width:700px) 90vw,44vw"
          />
        ))}
      </div>
      <div
        className="handi-controls"
        role="group"
        aria-label="Handi photograph views"
      >
        {labels.map((label, i) => (
          <button
            key={label}
            aria-pressed={view === i}
            onClick={() => setView(i)}
          >
            {label}
          </button>
        ))}
        <button aria-pressed={view === null} onClick={() => setView(null)}>
          {persistent ? "Follow scroll" : "Reset view"}
        </button>
      </div>
      <p className="handi-hint">
        {reduced
          ? "Choose a view to explore the handi."
          : persistent
            ? "Scroll to reveal · Move to explore"
            : "Choose a view · Move to explore"}
      </p>
    </section>
  );
}
