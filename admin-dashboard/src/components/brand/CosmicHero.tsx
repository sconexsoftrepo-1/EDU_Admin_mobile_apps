"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import CosmicEnvironment from "./CosmicEnvironment";
import BrandLogo from "./BrandLogo";
import { brandConfig as brand } from "./config/brandConfig";
import { useAnimation } from "../animation-system/AnimationProvider";
export default function CosmicHero() {
  const root = useRef<HTMLElement>(null),
    pointer = useRef({ x: 0, y: 0, scroll: 0 }),
    cta = useRef<HTMLAnchorElement>(null);
  const reduced = useReducedMotion(),
    { busy } = useAnimation();
  useEffect(() => {
    if (busy || !root.current || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".cosmic-hero-copy > *",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.65, stagger: 0.08, ease: "power2.out" },
      );
      gsap.to(pointer.current, {
        scroll: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(".cosmic-hero-copy", {
        y: -45,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      gsap.to(".cosmic-rocks", {
        y: 35,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }, root);
    return () => ctx.revert();
  }, [busy, reduced]);
  return (
    <section
      className="cosmic-hero"
      id="home"
      ref={root}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        const b = e.currentTarget.getBoundingClientRect();
        pointer.current.x = ((e.clientX - b.left) / b.width) * 2 - 1;
        pointer.current.y = ((e.clientY - b.top) / b.height) * 2 - 1;
        e.currentTarget.style.setProperty(
          "--cosmic-px",
          String(pointer.current.x),
        );
      }}
      onPointerLeave={() => {
        pointer.current.x = 0;
        pointer.current.y = 0;
      }}
    >
      <div className="cosmic-sky" />
      <CosmicEnvironment pointer={pointer} />
      <div className="cosmic-rocks" />
      <div className="cosmic-hero-copy">
        <p className="cosmic-eyebrow">
          {brand.eyebrow}
          <span>{brand.subtitle}</span>
        </p>
        <h1>
          <BrandLogo />
        </h1>
        <p className="cosmic-tagline">{brand.tagline}</p>
        <p className="cosmic-description">{brand.description}</p>
        <a
          ref={cta}
          className="cosmic-explore"
          href="#universe-templates"
          onPointerMove={(e) => {
            if (reduced || e.pointerType !== "mouse") return;
            const b = e.currentTarget.getBoundingClientRect();
            gsap.to(cta.current, {
              x: (e.clientX - b.left - b.width / 2) * 0.12,
              y: (e.clientY - b.top - b.height / 2) * 0.2,
              duration: 0.3,
            });
          }}
          onPointerLeave={() =>
            gsap.to(cta.current, { x: 0, y: 0, duration: 0.3 })
          }
        >
          Explore My Universe <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="cosmic-values" aria-hidden="true">
        <span>Ideas</span>
        <span>Design</span>
        <span>Technology</span>
        <span>Impact</span>
      </div>
      <a className="cosmic-scroll" href="#universe-templates">
        Discover the collection <ArrowDown size={15} />
      </a>
    </section>
  );
}
