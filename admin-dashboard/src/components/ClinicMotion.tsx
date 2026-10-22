"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
export default function ClinicMotion() {
  const marker = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let context: { revert: () => void } | undefined;
    import("gsap").then(async ({ gsap }) => {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.utils
          .toArray<HTMLElement>(
            "main .section-heading,main .about-strip h2,main .tech-art,main .journey-grid,main .faq-section",
          )
          .forEach((el) =>
            gsap.from(el, {
              y: 16,
              opacity: 0.3,
              duration: 0.8,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 94%", once: true },
            }),
          );
        gsap.utils
          .toArray<HTMLElement>(
            ".template-one .service-card,.template-one .doctor-card,.template-one .journey-grid>div",
          )
          .forEach((el, index) =>
            gsap.fromTo(
              el,
              { y: 20, opacity: 0.75, rotateY: index % 2 ? 2 : -2 },
              {
                y: 0,
                opacity: 1,
                rotateY: 0,
                duration: 0.6,
                ease: "power2.out",
                scrollTrigger: { trigger: el, start: "top 97%", once: true },
              },
            ),
          );
        gsap.to(".template-one .hero-glass-tooth", {
          rotate: 9,
          y: 65,
          ease: "none",
          scrollTrigger: {
            trigger: ".template-one .hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.7,
          },
        });
        gsap.to(".template-one .tech-art", {
          rotateY: -6,
          ease: "none",
          scrollTrigger: {
            trigger: ".template-one .tech-section",
            start: "top bottom",
            end: "bottom top",
            scrub: 0.7,
          },
        });
        gsap.fromTo(
          ".template-one .appointment-section",
          { backgroundColor: "#f4effb" },
          {
            backgroundColor: "#e8ddf6",
            ease: "none",
            scrollTrigger: {
              trigger: ".template-one .appointment-section",
              start: "top bottom",
              end: "bottom bottom",
              scrub: 0.6,
            },
          },
        );
        gsap.fromTo(
          ".clinic-scroll-progress",
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: { start: 0, end: "max", scrub: true },
          },
        );
        ScrollTrigger.refresh();
      });
    });
    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [path]);
  return (
    <div ref={marker} className="clinic-scroll-progress" aria-hidden="true" />
  );
}
