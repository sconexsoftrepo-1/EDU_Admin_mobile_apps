"use client";
import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
export function useShowroomMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils
          .toArray<HTMLElement>("[data-showroom-reveal]")
          .forEach((el) =>
            gsap.fromTo(
              el,
              { opacity: 0.65, y: 24 },
              {
                opacity: 1,
                y: 0,
                duration: 0.65,
                ease: "power2.out",
                scrollTrigger: { trigger: el, start: "top 95%", once: true },
              },
            ),
          );
        gsap.fromTo(
          ".reveal-browser",
          { rotateY: 12, y: 35 },
          {
            rotateY: 0,
            y: 0,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: {
              trigger: ".showroom-six-reveal",
              start: "top 95%",
              end: "bottom 55%",
              scrub: 0.6,
            },
          },
        );
        gsap.utils
          .toArray<HTMLElement>(".showroom-reveal-world")
          .forEach((world, i) => {
            gsap.fromTo(
              world,
              { rotateX: 12, rotateY: (i - 1) * 8, z: -70, y: 35 },
              {
                rotateX: 0,
                rotateY: 0,
                z: 0,
                y: 0,
                ease: "none",
                scrollTrigger: {
                  trigger: world,
                  start: "top 95%",
                  end: "center 45%",
                  scrub: 0.7,
                },
              },
            );
          });
        gsap.fromTo(
          ".spotlight-devices",
          { rotateX: 8, rotateY: -5, y: 40 },
          {
            rotateX: -3,
            rotateY: 4,
            y: -25,
            ease: "none",
            scrollTrigger: {
              trigger: ".showroom-spotlight",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          },
        );
        gsap.fromTo(
          ".explorer-glow",
          { xPercent: -20, opacity: 0.35 },
          {
            xPercent: 20,
            opacity: 0.8,
            ease: "none",
            scrollTrigger: {
              trigger: ".showroom-explorer",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.7,
            },
          },
        );
        gsap.fromTo(
          ".motion-study img",
          { y: 25, rotateY: -12 },
          {
            y: -15,
            rotateY: 6,
            stagger: 0.12,
            ease: "none",
            scrollTrigger: {
              trigger: ".motion-study",
              start: "top 95%",
              end: "bottom 35%",
              scrub: 0.4,
            },
          },
        );
      });
    }, root);
    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
      ctx.revert();
    };
  }, [root]);
}
