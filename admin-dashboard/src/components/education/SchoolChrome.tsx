"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { School } from "@/data/education";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
export function SchoolLogo({ school }: { school: School }) {
  return (
    <Link className="school-logo" href={`/education-schools/${school.slug}`}>
      <Image unoptimized src={school.logo} width={46} height={46} alt="" />
      <span>
        <strong>{school.name}</strong>
        <small>{school.level}</small>
      </span>
    </Link>
  );
}
const nav = [
  ["Our school", "about"],
  ["Leadership", "leadership"],
  ["Campus", "campus"],
  ["Student life", "student-life"],
  ["Contact", "contact"],
];
export default function SchoolChrome({
  school,
  children,
}: {
  school: School;
  children: ReactNode;
}) {
  const path = usePathname(),
    root = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const { markReady, busy } = useAnimation();
  const base = `/education-schools/${school.slug}`;
  useEffect(() => {
    markReady(path, "01");
    dialog.current?.close();
    root.current
      ?.querySelectorAll<HTMLDetailsElement>(".school-program-menu")
      .forEach((menu) => {
        menu.open = false;
      });
    const scroll = () =>
      root.current?.classList.toggle("school-is-scrolled", scrollY > 40);
    scroll();
    addEventListener("scroll", scroll, { passive: true });
    return () => removeEventListener("scroll", scroll);
  }, [path, markReady]);
  useEffect(() => {
    if (busy || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".school-hero-copy>* , .evergreen-hero-heading>*",
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.09,
            duration: 0.65,
            ease: "power2.out",
          },
        );
        const vision = root.current?.querySelector(".school-vision h2");
        if (vision)
          gsap.fromTo(
            ".school-vision h2>span>span",
            { yPercent: 100 },
            {
              yPercent: 0,
              stagger: 0.035,
              duration: 0.7,
              scrollTrigger: { trigger: vision, start: "top 87%", once: true },
            },
          );
        gsap.utils
          .toArray<HTMLElement>(".school-leadership figure")
          .forEach((figure) =>
            gsap.fromTo(
              figure,
              {
                clipPath:
                  school.slug === "little-sprouts"
                    ? "circle(15% at 50% 50%)"
                    : "inset(0 0 20% 0)",
              },
              {
                clipPath:
                  school.slug === "little-sprouts"
                    ? "circle(75% at 50% 50%)"
                    : "inset(0 0 0% 0)",
                duration: 1,
                scrollTrigger: {
                  trigger: figure,
                  start: "top 88%",
                  once: true,
                },
              },
            ),
          );
        gsap.utils
          .toArray<HTMLElement>(".school-discovery figure img")
          .forEach((image) =>
            gsap.fromTo(
              image,
              { scale: 1.1, yPercent: -5 },
              {
                scale: 1,
                yPercent: 4,
                ease: "none",
                scrollTrigger: {
                  trigger: image.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.8,
                },
              },
            ),
          );
        if (school.slug === "little-sprouts")
          gsap.utils
            .toArray<HTMLElement>(".school-program-grid>button")
            .forEach((card, i) =>
              gsap.fromTo(
                card,
                { rotate: i % 2 ? -4 : 4, y: 40, scale: 0.95 },
                {
                  rotate: 0,
                  y: 0,
                  scale: 1,
                  duration: 0.7,
                  scrollTrigger: {
                    trigger: card,
                    start: "top 93%",
                    once: true,
                  },
                },
              ),
            );
        if (school.slug === "sunrise-international")
          gsap.to(".sunrise-hero .school-hero-art", {
            yPercent: 8,
            ease: "none",
            scrollTrigger: {
              trigger: ".sunrise-hero",
              start: "top top",
              end: "bottom top",
              scrub: 0.7,
            },
          });
        if (school.slug === "maplewood-high")
          gsap.utils
            .toArray<HTMLElement>(
              ".school-program-detail,.school-dashboard-panel",
            )
            .forEach((panel) =>
              gsap.fromTo(
                panel,
                { clipPath: "inset(0 12% 0 0)" },
                {
                  clipPath: "inset(0 0% 0 0)",
                  duration: 1,
                  scrollTrigger: {
                    trigger: panel,
                    start: "top 88%",
                    once: true,
                  },
                },
              ),
            );
        if (school.slug === "evergreen-global")
          gsap.utils
            .toArray<HTMLElement>(".school-leadership blockquote")
            .forEach((quote) =>
              gsap.fromTo(
                quote,
                { "--quote-line": "0%" },
                {
                  "--quote-line": "100%",
                  scrollTrigger: {
                    trigger: quote,
                    start: "top 85%",
                    end: "bottom 55%",
                    scrub: 0.7,
                  },
                },
              ),
            );
        gsap.utils
          .toArray<HTMLElement>(".school-achievements article>span")
          .forEach((trophy) =>
            gsap.fromTo(
              trophy,
              { rotateY: -65, y: 15 },
              {
                rotateY: 0,
                y: 0,
                duration: 0.8,
                scrollTrigger: {
                  trigger: trophy,
                  start: "top 90%",
                  once: true,
                },
              },
            ),
          );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [path, busy, school.slug]);
  return (
    <div
      ref={root}
      className={`school-site school-${school.slug}`}
      style={
        {
          "--school-bg": school.colors.bg,
          "--school-ink": school.colors.ink,
          "--school-accent": school.colors.accent,
          "--school-soft": school.colors.soft,
          "--school-secondary": school.colors.secondary,
        } as CSSProperties
      }
    >
      <a className="school-skip" href="#school-main">
        Skip to school content
      </a>
      <div className="school-demo-strip">
        <Link href="/education-schools">← Education & Schools</Link>
        <span>Fictional school · Generated imagery & demo profiles</span>
        <Link href="/templates">All 20 templates ↗</Link>
      </div>
      <header className="school-nav">
        <SchoolLogo school={school} />
        <nav aria-label="School navigation">
          <Link
            href={`${base}/about`}
            aria-current={path === `${base}/about` ? "page" : undefined}
          >
            Our school
          </Link>
          <details
            className="school-program-menu"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>Academics</summary>
            <div>
              <Link href={`${base}/academics`}>All programs</Link>
              {school.programs.map((p) => (
                <Link href={`${base}/academics/${p.slug}`} key={p.slug}>
                  {p.name}
                </Link>
              ))}
            </div>
          </details>
          {nav.slice(1).map(([name, route]) => (
            <Link
              key={route}
              href={`${base}/${route}`}
              aria-current={path === `${base}/${route}` ? "page" : undefined}
            >
              {name}
            </Link>
          ))}
        </nav>
        <Link className="school-button" href={`${base}/admissions`}>
          {school.slug === "little-sprouts" ? "Enquire now" : "Admissions"} ↗
        </Link>
        <button
          ref={trigger}
          className="school-menu-toggle"
          aria-label="Open school menu"
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          ☰
        </button>
      </header>
      <dialog
        ref={dialog}
        className="school-mobile-menu"
        aria-label="School menu"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          onClick={() => dialog.current?.close()}
          aria-label="Close school menu"
        >
          Close ×
        </button>
        <SchoolLogo school={school} />
        <nav aria-label="Mobile school navigation">
          {[
            ["Home", ""],
            ...nav,
            ["Academics", "academics"],
            ["Facilities", "facilities"],
            ["Faculty", "faculty"],
            ["Gallery", "gallery"],
            ["Admissions", "admissions"],
          ].map(([name, route]) => (
            <Link
              key={route}
              href={`${base}/${route}`}
              onClick={() => dialog.current?.close()}
            >
              {name} ↗
            </Link>
          ))}
        </nav>
      </dialog>
      <main id="school-main">{children}</main>
      <footer className="school-footer">
        <div className="school-footer-invitation">
          <span className="school-eyebrow">{school.tagline}</span>
          <h2>{school.closing}</h2>
          <Link className="school-button" href={`${base}/admissions`}>
            Begin a demo enquiry ↗
          </Link>
        </div>
        <div className="school-footer-grid">
          <div>
            <SchoolLogo school={school} />
            <p>{school.description}</p>
            <small>
              Fictional school concept. No operational address, phone number or
              real school affiliation is claimed.
            </small>
          </div>
          <nav aria-label="School footer navigation">
            {[
              ...nav,
              ["Academics", "academics"],
              ["Facilities", "facilities"],
              ["Faculty", "faculty"],
              ["Gallery", "gallery"],
              ["Admissions", "admissions"],
              ["FAQ", "faq"],
            ].map(([name, route]) => (
              <Link key={route} href={`${base}/${route}`}>
                {name}
              </Link>
            ))}
          </nav>
          <div>
            <h3>Like this website?</h3>
            <p>Discuss a school website with the designer, K. Chaitanya.</p>
            <WhatsAppLink
              message={`Hi Chaitanya, I’m interested in the ${school.name} website template.`}
            />
            <Link href="/contact">Write a project enquiry ↗</Link>
          </div>
        </div>
        <div className="school-footer-bottom">
          <Link href="/">✧ Back to KC Web Universe</Link>
          <span>
            Generated campus & portraits · Fictional activities and achievements
          </span>
          <span>Designed & Developed by K. Chaitanya</span>
        </div>
      </footer>
      <Link className="school-mobile-admit" href={`${base}/admissions`}>
        Explore admissions ↗
      </Link>
    </div>
  );
}
