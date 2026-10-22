"use client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ArrowDown } from "lucide-react";
import { useLiveReducedMotion } from "./hooks/useLiveReducedMotion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { universeTemplates as allUniverseTemplates } from "@/data/templateCatalogue";
import { useAnimation } from "../animation-system/AnimationProvider";
import type { AnimationTemplateId } from "../animation-system/config/animationRegistry";
import HeroCompanion from "./HeroCompanion";
export default function UniverseHero() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [category, setCategory] = useState("all");
  const universeTemplates = allUniverseTemplates.filter((t) =>
    category === "projects"
      ? t.external
      : category === "all"
        ? !t.external
        : category === "hotels"
          ? Boolean(t.hotelSlug)
          : category === "schools"
            ? Boolean(t.schoolSlug)
            : category === "restaurants"
              ? Boolean(t.restaurantSlug)
              : category === "colleges"
                ? Boolean(t.collegeSlug)
                : !t.collegeSlug &&
                  !t.external &&
                  !t.hotelSlug &&
                  !t.schoolSlug &&
                  !t.restaurantSlug,
  );
  const [viewport, embla] = useEmblaCarousel({
    loop: true,
    align: "center",
    watchSlides: false,
    containScroll: false,
  });
  const region = useRef<HTMLElement>(null);
  const { switchTemplate, switchHotel, switchSchool, switchRestaurant } =
    useAnimation();
  const reduced = useLiveReducedMotion();
  const selected = universeTemplates[active] || universeTemplates[0];
  const choose = useCallback(
    (i: number) => {
      embla?.scrollTo(
        (i + universeTemplates.length) % universeTemplates.length,
        Boolean(reduced),
      );
    },
    [embla, universeTemplates.length, reduced],
  );
  useEffect(() => {
    embla?.reInit({ startIndex: 0 });
    embla?.scrollTo(0, true);
  }, [embla, category]);
  useEffect(() => {
    if (!embla) return;
    const select = () => setActive(embla.selectedScrollSnap());
    embla.on("select", select);
    return () => {
      embla.off("select", select);
    };
  }, [embla]);
  useEffect(() => {
    if (!embla || !region.current) return;
    const el = region.current.querySelector<HTMLElement>(
      ".universe-hero-viewport",
    )!;
    const paint = () => {
      const viewport = el.getBoundingClientRect();
      embla.slideNodes().forEach((slide) => {
        const box = slide.getBoundingClientRect();
        const distance = Math.max(
          -2,
          Math.min(
            2,
            (box.left + box.width / 2 - viewport.left - viewport.width / 2) /
              box.width,
          ),
        );
        const depth = slide.querySelector<HTMLElement>(".universe-hero-depth")!;
        depth.style.transform = reduced
          ? "none"
          : `perspective(1400px) translateZ(${-Math.abs(distance) * 170}px) rotateY(${-distance * 32}deg) scale(${1 - Math.min(Math.abs(distance), 1) * 0.13})`;
        slide.style.opacity = String(
          1 - Math.min(Math.abs(distance), 1.5) * 0.3,
        );
      });
    };
    let lastWheel = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) + Math.abs(event.deltaY) < 8)
        return;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      const index = embla.selectedScrollSnap();
      if (
        (index === 0 && delta < 0) ||
        (index === universeTemplates.length - 1 && delta > 0)
      )
        return;
      event.preventDefault();
      if (performance.now() - lastWheel < 650) return;
      lastWheel = performance.now();
      delta > 0 ? embla.scrollNext() : embla.scrollPrev();
    };
    paint();
    embla.on("scroll", paint).on("reInit", paint);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      embla.off("scroll", paint).off("reInit", paint);
      el.removeEventListener("wheel", wheel);
    };
  }, [embla, reduced, category, universeTemplates.length]);
  useEffect(() => {
    if (reduced || !region.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".universe-hero-intro h1",
        { y: 22, opacity: 0.6 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      );
      gsap.fromTo(
        ".universe-hero-viewport",
        { rotateX: 8, y: 30 },
        { rotateX: 0, y: 0, duration: 0.9, ease: "power3.out" },
      );
      gsap.to(".universe-hero-perspective", {
        rotateX: 7,
        y: -45,
        scale: 0.95,
        ease: "none",
        scrollTrigger: {
          trigger: region.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.7,
        },
      });
      gsap.to(".universe-hero-intro", {
        y: -30,
        opacity: 0.5,
        ease: "none",
        scrollTrigger: {
          trigger: region.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.7,
        },
      });
    }, region);
    return () => ctx.revert();
  }, [reduced]);
  return (
    <section
      className="universe-hero"
      id="universe-templates"
      ref={region}
      style={{ "--hero-accent": selected.accent } as React.CSSProperties}
    >
      <div className="universe-hero-intro">
        <div>
          <span className="showroom-kicker">
            Websites, templates & mobile experiences
          </span>
          <h2 className="universe-stage-title">Explore the collection.</h2>
        </div>
        <p>
          Twenty-two complete website templates plus selected healthcare,
          commerce & portfolio projects. Drag the previews to find your world.
        </p>
      </div>
      <div
        className="universe-hotel-filters"
        role="group"
        aria-label="Featured collections"
      >
        {[
          ["all", "All Templates · 22"],
          ["dental", "Dental Clinics · 6"],
          ["hotels", "Hotels & Resorts · 4"],
          ["schools", "Education & Schools · 4"],
          ["restaurants", "Restaurants & Food · 6"],
          ["colleges", "Colleges & Institutions · 2"],
          ["projects", "Selected projects · 4"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => {
              setActive(0);
              setCategory(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="universe-hero-perspective">
        <div
          key={category}
          className="universe-hero-viewport"
          ref={viewport}
          role="region"
          aria-label="Featured website templates"
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              choose(active + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
          onPointerMove={(e) => {
            if (e.pointerType !== "mouse" || e.buttons || reduced) return;
            const b = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--hero-pointer-x",
              String((e.clientX - b.left) / b.width - 0.5),
            );
            e.currentTarget.style.setProperty(
              "--hero-pointer-y",
              String((e.clientY - b.top) / b.height - 0.5),
            );
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty("--hero-pointer-x", "0");
            e.currentTarget.style.setProperty("--hero-pointer-y", "0");
          }}
        >
          <div className="universe-hero-track">
            {universeTemplates.map((item, index) => (
              <article
                key={item.id}
                className={`universe-hero-slide ${active === index ? "is-active" : ""}`}
                aria-label={`${index + 1} of ${universeTemplates.length}: ${item.title}`}
                style={
                  { "--hero-slide-accent": item.accent } as React.CSSProperties
                }
              >
                <div className="universe-hero-depth">
                  <div className="universe-hero-window">
                    <div className="showcase-browser-chrome">
                      <i />
                      <i />
                      <i />
                      <span>{item.category}</span>
                      <b>
                        {String(index + 1).padStart(2, "0")} /{" "}
                        {universeTemplates.length}
                      </b>
                    </div>
                    <div className="universe-hero-preview">
                      <Image
                        unoptimized
                        priority={index === 0}
                        src={item.image}
                        fill
                        sizes="(max-width:700px) 90vw, 82vw"
                        alt={`${item.title} featured website preview`}
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div className="universe-hero-caption">
        <div className="universe-hero-template-title" aria-live="polite">
          <span className="showroom-kicker">{selected.category}</span>
          <h2>{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
        <div className="universe-hero-actions">
          <HeroCompanion />
          {selected.external ? (
            <a
              className="showroom-button"
              href={selected.href}
              target="_blank"
              rel="noreferrer"
            >
              Explore {selected.title} <ArrowUpRight size={17} />
            </a>
          ) : (
            <button
              className="showroom-button"
              onClick={() =>
                selected.collegeSlug
                  ? router.push(selected.href)
                  : selected.restaurantSlug
                    ? switchRestaurant(selected.restaurantSlug, selected.href)
                    : selected.schoolSlug
                      ? switchSchool(selected.schoolSlug, selected.href)
                      : selected.hotelSlug
                        ? switchHotel(selected.hotelSlug, selected.href)
                        : switchTemplate(
                            selected.id as AnimationTemplateId,
                            selected.href,
                          )
              }
            >
              Explore this template <ArrowUpRight size={17} />
            </button>
          )}
        </div>
      </div>
      <div className="universe-hero-controls">
        <div
          className="universe-hero-pagination"
          aria-label="Select a featured template"
        >
          {universeTemplates.map((item, i) => (
            <button
              key={item.id}
              aria-label={`Feature ${item.title}`}
              aria-pressed={active === i}
              onClick={() => choose(i)}
            >
              <span>{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
        <span>Scroll previews / Drag / Swipe</span>
        <div className="universe-hero-arrows">
          <button
            onClick={() => choose(active - 1)}
            aria-label="Previous featured template"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={() => choose(active + 1)}
            aria-label="Next featured template"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
      <div className="universe-hero-bottom">
        <Link href="/templates">
          Browse all categories <ArrowUpRight size={15} />
        </Link>
        <a href="#categories">
          Scroll to discover <ArrowDown size={15} />
        </a>
      </div>
    </section>
  );
}
