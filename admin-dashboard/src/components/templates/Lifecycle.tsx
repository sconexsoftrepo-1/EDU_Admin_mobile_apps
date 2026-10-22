"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AnimationReady from "../animation-system/AnimationReady";
import type { TemplateId } from "@/data/experiences";
export default function Lifecycle({ id }: { id: TemplateId }) {
  const root = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    import("gsap").then(async ({ gsap }) => {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        const scope = root.current?.parentElement;
        gsap.utils
          .toArray<HTMLElement>(".scroll-reveal", scope)
          .forEach((el) => {
            const cards = el.querySelectorAll<HTMLElement>(
              ".exp-service,.exp-doctor,.gallery-card,li",
            );
            const targets = cards.length ? Array.from(cards) : [el];
            targets.forEach((target, index) =>
              gsap.fromTo(
                target,
                {
                  opacity: 0.68,
                  y: id === "03" ? 16 : id === "04" ? 8 : 20,
                  rotateY: id === "02" ? 3 : 0,
                },
                {
                  opacity: 1,
                  y: 0,
                  rotateY: 0,
                  duration: id === "04" ? 0.8 : 0.55,
                  delay: Math.min((index % 3) * 0.045, 0.09),
                  ease: id === "03" ? "back.out(1.15)" : "power2.out",
                  scrollTrigger: {
                    trigger: target,
                    start: "top 97%",
                    once: true,
                  },
                },
              ),
            );
          });
        gsap.utils
          .toArray<HTMLElement>(
            ".about-image,.exp-portrait,.exp-gallery .gallery-card",
            scope,
          )
          .forEach((el) =>
            gsap.fromTo(
              el,
              { clipPath: id === "04" ? "inset(0 0 5% 0)" : "inset(0 0 3% 0)" },
              {
                clipPath: "inset(0 0 0% 0)",
                duration: 0.7,
                scrollTrigger: { trigger: el, start: "top 98%", once: true },
              },
            ),
          );
        if (id === "05") {
          gsap.to(".lifestyle-ribbon", {
            rotate: 20,
            yPercent: 42,
            ease: "none",
            scrollTrigger: {
              trigger: ".lifestyle-hero",
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
          gsap.to(".lifestyle-pearl-stage", {
            y: 70,
            rotate: -7,
            ease: "none",
            scrollTrigger: {
              trigger: ".lifestyle-hero",
              start: "top top",
              end: "bottom top",
              scrub: 0.8,
            },
          });
        }
        gsap.utils
          .toArray<HTMLElement>(
            ".exp-booking .exp-form-shell,.exp-journey li",
            scope,
          )
          .forEach((el) =>
            gsap.fromTo(
              el,
              { y: 12, opacity: 0.8 },
              {
                y: 0,
                opacity: 1,
                duration: 0.55,
                scrollTrigger: { trigger: el, start: "top 98%", once: true },
              },
            ),
          );
        gsap.fromTo(
          ".exp-scroll-progress",
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { start: 0, end: "max", scrub: true },
          },
        );
        ScrollTrigger.refresh();
      }, root.current?.parentElement || undefined);
    });
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [path, id]);
  return (
    <div ref={root} className="lifecycle-root">
      <div className="exp-scroll-progress" aria-hidden="true" />
      <AnimationReady templateId={id} />
    </div>
  );
}
