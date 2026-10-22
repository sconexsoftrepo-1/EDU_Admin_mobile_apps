"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Restaurant } from "@/data/restaurants";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import { RestaurantCartProvider, useRestaurantCart } from "./RestaurantCart";
import { CartDrawer } from "./Ordering";
import FoodJourney from "./FoodJourney";
function Chrome({ r, children }: { r: Restaurant; children: ReactNode }) {
  const path = usePathname(),
    router = useRouter(),
    root = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    { markReady, busy } = useAnimation(),
    { cart } = useRestaurantCart(),
    base = `/restaurants-food/${r.slug}`;
  const links = [
    ["Our story", "about"],
    ["Menu", "menu"],
    ["Our chefs", "our-chefs"],
    ["Gallery", "gallery"],
    ["Experiences", "experiences"],
    ["Contact", "contact"],
  ];
  useEffect(() => {
    markReady(path, "01");
    dialog.current?.close();
    document.dispatchEvent(new Event("restaurant:route-ready"));
  }, [path, markReady]);
  useEffect(() => {
    if (busy) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".food-route-content",
          { opacity: 0.5, clipPath: "inset(0 0 4% 0)" },
          {
            opacity: 1,
            clipPath: "inset(0 0 0% 0)",
            duration: 0.45,
            ease: "power2.out",
          },
        );
        gsap.fromTo(
          ".food-hero-copy>* , .spice-hero-side>*",
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.09,
            duration: 0.65,
            ease: "power2.out",
          },
        );
        gsap.utils
          .toArray<HTMLElement>(
            ".food-building-image,.food-owner-portrait,.food-chef-grid figure",
          )
          .forEach((el, i) =>
            gsap.fromTo(
              el,
              {
                clipPath:
                  r.slug === "greenbowl-cafe"
                    ? "ellipse(30% 30% at 50% 50%)"
                    : "inset(0 0 18% 0)",
                y: 16,
              },
              {
                clipPath:
                  r.slug === "greenbowl-cafe"
                    ? "ellipse(80% 80% at 50% 50%)"
                    : "inset(0 0 0% 0)",
                y: 0,
                duration: 0.9,
                scrollTrigger: { trigger: el, start: "top 90%", once: true },
                delay: (i % 3) * 0.05,
              },
            ),
          );
        gsap.fromTo(
          ".food-building-image img",
          { scale: 1.1, yPercent: -4 },
          {
            scale: 1,
            yPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: ".food-building-image",
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          },
        );
        gsap.to(".spice-floating-mark", {
          rotate: 130,
          y: 180,
          ease: "none",
          scrollTrigger: {
            trigger: ".spice-home",
            start: "top top",
            end: "35% top",
            scrub: 0.7,
          },
        });
        gsap.to(".ocean-wave", {
          xPercent: -8,
          scaleX: 1.15,
          ease: "none",
          scrollTrigger: {
            trigger: ".ocean-hero",
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
        gsap.utils
          .toArray<HTMLElement>(".food-card-image img")
          .forEach((img) =>
            gsap.fromTo(
              img,
              { scale: 1.05 },
              {
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: img,
                  start: "top bottom",
                  end: "bottom center",
                  scrub: 0.5,
                },
              },
            ),
          );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [path, r.slug, busy]);
  return (
    <div
      ref={root}
      className={`restaurant-site food-${r.slug}`}
      style={
        {
          "--food-bg": r.colors.bg,
          "--food-ink": r.colors.ink,
          "--food-accent": r.colors.accent,
          "--food-soft": r.colors.soft,
          "--food-gold": r.colors.gold,
        } as React.CSSProperties
      }
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (
          !anchor ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0 ||
          anchor.target ||
          !document.startViewTransition ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const target = new URL(anchor.href);
        if (
          target.origin !== location.origin ||
          !target.pathname.startsWith(base) ||
          target.pathname === path
        )
          return;
        event.preventDefault();
        document.startViewTransition(
          () =>
            new Promise<void>((resolve) => {
              let timer: ReturnType<typeof setTimeout>;
              const done = () => {
                clearTimeout(timer);
                document.removeEventListener("restaurant:route-ready", done);
                resolve();
              };
              document.addEventListener("restaurant:route-ready", done);
              timer = setTimeout(done, 1400);
              router.push(target.pathname + target.search + target.hash);
            }),
        );
      }}
    >
      <a className="food-skip" href="#restaurant-main">
        Skip to content
      </a>
      <div className="food-demo-bar">
        <Link href="/restaurants-food">← Restaurants & Food</Link>
        <span>Fictional restaurant · Local ordering demo</span>
        <Link href="/templates">All 20 templates ↗</Link>
      </div>
      <header className="food-nav">
        <Link className="food-brand" href={base}>
          <Image unoptimized src={r.logo} width={42} height={42} alt="" />
          <span>
            <strong>{r.name}</strong>
            <small>{r.kind}</small>
          </span>
        </Link>
        <nav aria-label="Restaurant navigation">
          {links.map(([label, route]) => (
            <Link
              key={route}
              href={`${base}/${route}`}
              aria-current={path === `${base}/${route}` ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          className="food-nav-cta"
          href={`${base}/${r.slug === "biryani-express" || r.slug === "greenbowl-cafe" ? "order" : "reservations"}`}
        >
          {r.slug === "biryani-express" || r.slug === "greenbowl-cafe"
            ? "Order demo"
            : "Book a table"}{" "}
          ↗
        </Link>
        <Link
          className="food-nav-cart"
          href={`${base}/cart`}
          aria-label={`Cart, ${cart.items.reduce((n, l) => n + l.quantity, 0)} items`}
        >
          Bag <b>{cart.items.reduce((n, l) => n + l.quantity, 0)}</b>
        </Link>
        <button
          ref={trigger}
          className="food-menu-toggle"
          aria-label="Open restaurant menu"
          onClick={() => dialog.current?.showModal()}
        >
          ☰
        </button>
      </header>
      <dialog
        ref={dialog}
        className="food-mobile-menu"
        aria-label="Restaurant mobile navigation"
        onClose={() => trigger.current?.focus()}
      >
        <button
          aria-label="Close restaurant menu"
          onClick={() => dialog.current?.close()}
        >
          ✕
        </button>
        <h2>{r.name}</h2>
        <nav>
          {[
            ["Home", ""],
            ...links,
            ["Reservations", "reservations"],
            ["Order", "order"],
            ["Table QR studio", "qr"],
          ].map(([label, route]) => (
            <Link
              key={label}
              href={`${base}${route ? "/" + route : ""}`}
              onClick={() => dialog.current?.close()}
            >
              {label} ↗
            </Link>
          ))}
        </nav>
      </dialog>
      {(r.slug === "royal-biryani-house" || r.slug === "biryani-express") && (
        <FoodJourney restaurant={r} persistent />
      )}
      <main id="restaurant-main" className="food-route-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="food-footer">
        <div className="food-wrap">
          <div className="food-footer-top">
            <Image unoptimized src={r.logo} width={56} height={56} alt="" />
            <h2>
              {r.slug === "biryani-express"
                ? "The next great bowl is waiting."
                : r.slug === "greenbowl-cafe"
                  ? "Make room for a brighter day."
                  : "Make a little room for something memorable."}
            </h2>
            <Link className="food-button" href={`${base}/menu`}>
              Find your flavour ↗
            </Link>
          </div>
          <div className="food-footer-grid">
            <div>
              <h3>{r.name}</h3>
              <p>{r.tagline}</p>
              <p>Est. {r.year} · Fictional brand story</p>
              <small>
                Generated architecture, food & portraits. No operational
                address, ratings or certifications are claimed.
              </small>
            </div>
            <nav aria-label="Restaurant footer navigation">
              {[
                ...links,
                ["Reservations", "reservations"],
                ["Order", "order"],
                ["Cart", "cart"],
                ["FAQ", "faq"],
                ["QR table studio", "qr"],
                ["Kitchen simulation", "demo-kitchen"],
              ].map(([label, route]) => (
                <Link key={label} href={`${base}/${route}`}>
                  {label}
                </Link>
              ))}
            </nav>
            <div>
              <h3>Like this restaurant website?</h3>
              <p>Discuss your own project with K. Chaitanya.</p>
              <WhatsAppLink
                message={`Hi Chaitanya, I’m interested in the ${r.name} restaurant website template.`}
              />
              <Link href="/contact">Write a project enquiry ↗</Link>
            </div>
          </div>
          <div className="food-footer-bottom">
            <Link href="/">✧ KC Web Universe</Link>
            <span>Fictional demo · No orders or bookings are sent</span>
            <span>Designed & Developed by K. Chaitanya</span>
          </div>
        </div>
      </footer>
      <CartDrawer restaurant={r} />
    </div>
  );
}
export default function RestaurantChrome({
  restaurant,
  children,
}: {
  restaurant: Restaurant;
  children: ReactNode;
}) {
  return (
    <RestaurantCartProvider key={restaurant.slug} restaurant={restaurant}>
      <Chrome r={restaurant}>{children}</Chrome>
    </RestaurantCartProvider>
  );
}
