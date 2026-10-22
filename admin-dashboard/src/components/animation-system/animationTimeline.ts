import { gsap } from "gsap";
import {
  animationRegistry,
  type AnimationRun,
} from "./config/animationRegistry";
export type SequenceCallbacks = {
  covered: () => void;
  readyToFinish: () => void;
  complete: () => void;
  stage: (stage: number) => void;
};
export function buildAnimationTimeline(
  root: HTMLElement,
  run: AnimationRun,
  events: SequenceCallbacks,
) {
  const cfg = animationRegistry[run.templateId],
    clock = run.clock;
  const q = gsap.utils.selector(root);
  const surface = q("[data-surface]"),
    brand = q("[data-brand]"),
    taglines = q("[data-tagline]"),
    rings = q("[data-dom-orbit]"),
    tiles = q("[data-tile]"),
    beam = q("[data-sweep]");
  const timeline = gsap.timeline({
    paused: true,
    onComplete: events.complete,
    onUpdate: () => {
      const stage =
        run.mode === "initial"
          ? clock.time < 0.4
            ? 0
            : clock.time < 1
              ? 1
              : clock.time < 1.8
                ? 2
                : clock.time < 2.4
                  ? 3
                  : 4
          : clock.exit > 0.05
            ? 4
            : 2;
      events.stage(stage);
    },
  });
  gsap.set(root, { opacity: 1 });
  gsap.set(brand, { autoAlpha: 0, y: 10 });
  gsap.set(taglines, { autoAlpha: 0, y: 12, clipPath: "inset(100% 0 0 0)" });
  gsap.set(rings, { scale: 0.65, opacity: 0 });
  gsap.set(beam, { opacity: 0 });
  const reveal = (at: number, duration: number) => {
    timeline.to(
      clock,
      {
        exit: 1,
        duration,
        ease: cfg.transition === "bubble" ? "power2.inOut" : "power2.in",
        onStart: () => events.stage(4),
      },
      at,
    );
    timeline.to(
      q("[data-scene]"),
      {
        opacity: 0,
        scale:
          run.templateId === "02" ? 1.8 : run.templateId === "05" ? 0.9 : 1.12,
        duration: duration * 0.8,
        ease: "power2.in",
      },
      at,
    );
    timeline.to(
      [brand, taglines],
      { autoAlpha: 0, y: -12, duration: duration * 0.45 },
      at,
    );
    if (run.reduced) {
      timeline.to(root, { opacity: 0, duration }, at);
      return;
    }
    if (cfg.transition === "gold-sweep" || cfg.transition === "ribbon") {
      timeline.to(
        surface,
        {
          clipPath: "inset(0 0 0 100%)",
          duration,
          ease: cfg.transition === "ribbon" ? "sine.inOut" : "power2.inOut",
        },
        at,
      );
      timeline.fromTo(
        beam,
        { left: "-15%", opacity: 0.8 },
        { left: "115%", opacity: 0, duration, ease: "sine.inOut" },
        at,
      );
    } else if (cfg.transition === "tiles") {
      timeline.to(q("[data-backdrop]"), { opacity: 0, duration: 0.05 }, at);
      timeline.fromTo(
        tiles,
        { scaleY: 1, opacity: 1 },
        {
          scaleY: 0,
          opacity: 0,
          stagger: { amount: duration * 0.45, from: "center" },
          duration: duration * 0.55,
          ease: "power2.inOut",
        },
        at,
      );
      timeline.to(q("[data-grid]"), { opacity: 0, duration }, at);
    } else {
      timeline.to(
        surface,
        {
          "--aperture": "155%",
          duration,
          ease: cfg.transition === "bubble" ? "power2.inOut" : "power2.in",
        },
        at,
      );
      timeline.to(
        rings,
        { scale: 8, opacity: 0, duration, ease: "power2.in" },
        at,
      );
    }
    timeline.to(
      root,
      { opacity: 0, duration: Math.min(0.1, duration * 0.25) },
      at + duration - Math.min(0.1, duration * 0.25),
    );
  };
  if (run.mode === "switch") {
    const cover = run.reduced ? 0.08 : 0.32,
      end = run.reduced ? 0.18 : 0.8;
    if (run.reduced) {
      gsap.set(root, { opacity: 0 });
      timeline.to(root, { opacity: 1, duration: cover }, 0);
    } else if (cfg.transition === "gold-sweep") {
      gsap.set(surface, { clipPath: "inset(49.8% 0 49.8% 0)" });
      timeline.to(
        surface,
        { clipPath: "inset(0% 0 0% 0)", duration: cover, ease: "power2.inOut" },
        0,
      );
      timeline.fromTo(
        beam,
        { left: "-15%", opacity: 0.8 },
        { left: "115%", opacity: 0.2, duration: cover },
        0,
      );
    } else if (cfg.transition === "ribbon") {
      gsap.set(surface, { clipPath: "inset(0 100% 0 0)" });
      timeline.to(
        surface,
        { clipPath: "inset(0 0% 0 0)", duration: cover, ease: "sine.inOut" },
        0,
      );
    } else if (cfg.transition === "tiles") {
      gsap.set(q("[data-backdrop]"), { opacity: 0 });
      gsap.set(tiles, { scaleY: 0, transformOrigin: "center" });
      timeline.to(
        tiles,
        {
          scaleY: 1,
          stagger: { amount: 0.14, from: "end" },
          duration: cover - 0.14,
          ease: "power2.inOut",
        },
        0,
      );
      timeline.to(
        q("[data-backdrop]"),
        { opacity: 1, duration: 0.04 },
        cover - 0.04,
      );
    } else {
      const origin =
        cfg.transition === "bubble" || cfg.transition === "lavender"
          ? `${run.origin.x}% ${run.origin.y}%`
          : "50% 50%";
      gsap.set(surface, { clipPath: `circle(0% at ${origin})` });
      timeline.to(
        surface,
        {
          clipPath: `circle(150% at ${origin})`,
          duration: cover,
          ease: "power2.inOut",
        },
        0,
      );
    }
    timeline.to(
      clock,
      {
        time: cover,
        ambient: 1,
        brand: 1,
        scan: 0.6,
        duration: cover,
        ease: "none",
      },
      0,
    );
    timeline.to(
      brand,
      { autoAlpha: 1, y: 0, duration: cover * 0.65 },
      cover * 0.15,
    );
    timeline.to(rings, { scale: 1, opacity: 0.5, duration: cover }, 0);
    timeline.addLabel("covered", cover);
    timeline.addPause("covered", events.covered);
    reveal(cover, end - cover);
    timeline.addLabel("finished", end);
  } else if (run.mode === "refresh") {
    timeline.to(
      clock,
      {
        time: 1.4,
        ambient: 1,
        formation: 1,
        brand: 1,
        scan: 1,
        rotation: 0.45,
        duration: 1.4,
        ease: "none",
      },
      0,
    );
    timeline.to(
      rings,
      { scale: 1.1, opacity: 0.55, duration: 0.45, ease: "sine.out" },
      0,
    );
    timeline.to(brand, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.25);
    if (run.templateId === "04")
      timeline.fromTo(
        beam,
        { left: "-15%", opacity: 0 },
        { left: "115%", opacity: 0.7, duration: 0.65 },
        0.15,
      );
    timeline.addPause(1.02, events.readyToFinish);
    reveal(1.02, 0.38);
  } else {
    timeline.to(clock, { time: 3, duration: 3, ease: "none" }, 0);
    timeline.to(clock, { ambient: 1, duration: 0.4, ease: "sine.out" }, 0);
    timeline.to(
      clock,
      {
        formation: 1,
        assembly: 0,
        rotation: 0.15,
        duration: 0.6,
        ease: run.templateId === "03" ? "back.out(1.45)" : "power2.inOut",
      },
      0.4,
    );
    timeline.to(
      clock,
      { brand: 1, scan: 1, duration: 0.8, ease: "sine.inOut" },
      1,
    );
    timeline.to(
      rings,
      { opacity: 0.5, scale: 1, duration: 0.6, ease: "sine.out" },
      0.15,
    );
    timeline.to(
      brand,
      { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
      1,
    );
    timeline.to(
      taglines,
      {
        autoAlpha: 1,
        y: 0,
        clipPath: "inset(0% 0 0 0)",
        stagger: 0.12,
        duration: 0.34,
        ease: "power2.out",
      },
      1.8,
    );
    if (run.templateId === "04")
      timeline.fromTo(
        beam,
        { left: "-15%", opacity: 0 },
        { left: "115%", opacity: 0.55, duration: 0.7 },
        1,
      );
    timeline.addPause(2.4, events.readyToFinish);
    reveal(2.4, 0.6);
  }
  if (!run.reduced)
    timeline.timeScale(timeline.duration() / cfg.duration[run.mode]);
  return timeline;
}
