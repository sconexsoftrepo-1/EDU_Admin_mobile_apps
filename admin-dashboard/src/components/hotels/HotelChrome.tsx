"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Hotel } from "@/data/hotels-resorts";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
const links = [
  ["Our story", "about"],
  ["Stays", "rooms"],
  ["Experiences", "experiences"],
  ["Dining", "dining"],
  ["Wellness", "wellness"],
  ["Gallery", "gallery"],
];
export default function HotelChrome({
  hotel,
  children,
}: {
  hotel: Hotel;
  children: ReactNode;
}) {
  const path = usePathname(),
    root = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const { markReady, busy } = useAnimation();
  const [menu, setMenu] = useState(false);
  const base = `/hotels-resorts/${hotel.slug}`;
  useEffect(() => {
    if (!path.endsWith("/booking")) markReady(path, "01");
    dialog.current?.close();
  }, [path, markReady]);
  useEffect(() => {
    if (busy || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.utils
          .toArray<HTMLElement>("[data-hotel-reveal]")
          .forEach((node, i) =>
            gsap.fromTo(
              node,
              { y: hotel.slug === "luxury-hotel" ? 24 : 45, opacity: 0.15 },
              {
                y: 0,
                opacity: 1,
                duration: 0.8,
                delay: (i % 3) * 0.05,
                ease: "power2.out",
                scrollTrigger: { trigger: node, start: "top 94%", once: true },
              },
            ),
          );
        gsap.utils
          .toArray<HTMLElement>("[data-hotel-parallax]")
          .forEach((node) =>
            gsap.fromTo(
              node,
              { yPercent: -5, scale: 1.12 },
              {
                yPercent: 5,
                scale: 1.03,
                ease: "none",
                scrollTrigger: {
                  trigger: node.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.7,
                },
              },
            ),
          );
        if (hotel.slug === "resort-paradise")
          gsap.utils
            .toArray<HTMLElement>(".hotel-room-image")
            .forEach((image, i) =>
              gsap.fromTo(
                image,
                { clipPath: "inset(12% 0 12% 0)" },
                {
                  clipPath: "inset(0% 0 0% 0)",
                  duration: 1.1,
                  delay: i * 0.08,
                  ease: "power2.out",
                  scrollTrigger: {
                    trigger: image,
                    start: "top 88%",
                    once: true,
                  },
                },
              ),
            );
        if (hotel.slug === "luxury-hotel")
          gsap.utils
            .toArray<HTMLElement>(".hotel-suite-tour figure")
            .forEach((image) =>
              gsap.fromTo(
                image,
                { clipPath: "inset(0 100% 0 0)" },
                {
                  clipPath: "inset(0 0% 0 0)",
                  duration: 1.2,
                  ease: "power3.inOut",
                  scrollTrigger: {
                    trigger: image,
                    start: "top 88%",
                    once: true,
                  },
                },
              ),
            );
        const ocean = root.current?.querySelector(".hotel-ocean-story");
        if (ocean) {
          gsap.fromTo(
            ocean,
            { backgroundColor: "#023942" },
            {
              backgroundColor: "#32a8b6",
              scrollTrigger: {
                trigger: ocean,
                start: "top 80%",
                end: "bottom 30%",
                scrub: 1,
              },
            },
          );
          gsap.to(".hotel-ocean-fish", {
            x: 120,
            stagger: 0.1,
            scrollTrigger: {
              trigger: ocean,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
            },
          });
        }
        if (root.current?.querySelector(".hotel-trail-line"))
          gsap.to(".hotel-trail-line", {
            strokeDashoffset: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".hotel-trails",
              start: "top 85%",
              end: "bottom 45%",
              scrub: 1,
            },
          });
      }, root);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, [path, busy, hotel.slug]);
  return (
    <div
      ref={root}
      className={`hospitality hotel-${hotel.slug}`}
      style={
        {
          "--hotel-bg": hotel.palette.bg,
          "--hotel-ink": hotel.palette.ink,
          "--hotel-accent": hotel.palette.accent,
          "--hotel-soft": hotel.palette.soft,
        } as CSSProperties
      }
    >
      <a className="hotel-skip" href="#hotel-main">
        Skip to content
      </a>
      <div className="hotel-demo-strip">
        <Link href="/hotels-resorts">← Hotels & Resorts collection</Link>
        <span>Fictional property · Interactive website demo</span>
        <Link href="/templates">All templates ↗</Link>
      </div>
      <header className="hotel-nav">
        <Link href={base} className="hotel-logo">
          <span aria-hidden="true">{hotel.monogram}</span>
          <strong>{hotel.name}</strong>
        </Link>
        <nav aria-label="Hotel navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={`${base}/${href}`}
              aria-current={path === `${base}/${href}` ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link className="hotel-button" href={`${base}/booking`}>
          Book your stay <span>↗</span>
        </Link>
        <button
          ref={trigger}
          className="hotel-menu-toggle"
          aria-expanded={menu}
          aria-haspopup="dialog"
          aria-label="Open hotel menu"
          onClick={() => {
            dialog.current?.showModal();
            setMenu(true);
          }}
        >
          ☰
        </button>
      </header>
      <dialog
        ref={dialog}
        className="hotel-menu"
        onClose={() => {
          setMenu(false);
          trigger.current?.focus();
        }}
      >
        <button
          aria-label="Close hotel menu"
          onClick={() => dialog.current?.close()}
        >
          Close ×
        </button>
        <p>{hotel.name}</p>
        <nav aria-label="Mobile hotel navigation">
          {[
            ["Home", ""],
            ...links,
            ["Offers", "offers"],
            ["Contact", "contact"],
            ["Book your stay", "booking"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={`${base}/${href}`}
              onClick={() => dialog.current?.close()}
            >
              {label} ↗
            </Link>
          ))}
        </nav>
      </dialog>
      <main id="hotel-main">{children}</main>
      <footer className="hotel-footer">
        <span className="hotel-kicker">{hotel.concept}</span>
        <h2>{hotel.closing}</h2>
        <Link className="hotel-button" href={`${base}/booking`}>
          Plan a demo stay ↗
        </Link>
        <div className="hotel-footer-grid">
          <Link className="hotel-logo" href={base}>
            <span>{hotel.monogram}</span>
            <strong>{hotel.name}</strong>
          </Link>
          <nav aria-label="Hotel footer">
            {[
              ...links,
              ["Amenities", "amenities"],
              ["Offers", "offers"],
              ["FAQ", "faq"],
              ["Contact", "contact"],
            ].map(([label, href]) => (
              <Link key={href} href={`${base}/${href}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div>
            <p>
              A fictional hospitality concept.
              <br />
              Generated illustrative photography.
              <br />
              Rates & availability are demo data.
            </p>
            <Link href="/hotels-resorts">Explore all four hotels ↗</Link>
          </div>
        </div>
        <div className="hotel-footer-whatsapp">
          <span>Have a website idea? Talk to Chaitanya.</span>
          <WhatsAppLink
            message={`Hi Chaitanya, I’m interested in the ${hotel.name} website template.`}
          />
        </div>
        <div className="hotel-footer-credit">
          <Link href="/">✧ KC Web Universe</Link>
          <a
            href="https://chaitanya-portfolio-eight.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            Designed & Developed by K. Chaitanya ↗
          </a>
        </div>
      </footer>
      <Link className="hotel-mobile-book" href={`${base}/booking`}>
        Check demo availability ↗
      </Link>
    </div>
  );
}
