"use client";
import Link from "next/link";
import BrandLogo from "../brand/BrandLogo";
import { brandConfig } from "../brand/config/brandConfig";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
const groups = [
  {
    label: "Healthcare",
    description: "Care, with character.",
    links: [
      ["Dental Clinics", "/templates#dental", "6 website experiences"],
      ["Clinics & Family Care", "/templates#clinics", "Connected healthcare"],
      [
        "Ortho & Child Care",
        "/templates#ortho-child",
        "Care for every generation",
      ],
    ],
  },
  {
    label: "Education",
    description: "From first steps to new frontiers.",
    links: [
      ["Schools & Academies", "/education-schools", "4 school experiences"],
      [
        "Colleges & Institutions",
        "/colleges-institutions",
        "2 websites + campus ERP",
      ],
    ],
  },
  {
    label: "Hospitality",
    description: "Places to stay. Flavours to discover.",
    links: [
      ["Hotels & Resorts", "/hotels-resorts", "4 destination experiences"],
      ["Restaurants & Food", "/restaurants-food", "6 dining experiences"],
    ],
  },
  {
    label: "Explore",
    description: "More from the creative universe.",
    links: [
      ["The collection", "/#collection", "Explore all 22 templates"],
      ["Projects", "/#projects", "Selected client work"],
      ["Features", "/#features", "Interaction and motion"],
      ["Compare", "/#compare", "Find your design direction"],
    ],
  },
];
export default function UniverseNavigation() {
  const path = usePathname(),
    [open, setOpen] = useState(false),
    [compact, setCompact] = useState(false);
  const button = useRef<HTMLButtonElement>(null),
    header = useRef<HTMLElement>(null);
  function closeMenus() {
    setOpen(false);
    header.current
      ?.querySelectorAll<HTMLDetailsElement>("details[open]")
      .forEach((d) => (d.open = false));
  }
  useEffect(() => {
    const scroll = () => setCompact(scrollY > 40);
    const outside = (e: PointerEvent) => {
      if (!header.current?.contains(e.target as Node)) {
        header.current
          ?.querySelectorAll<HTMLDetailsElement>("details[open]")
          .forEach((d) => (d.open = false));
        setOpen(false);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const details = Array.from(
        header.current?.querySelectorAll<HTMLDetailsElement>("details[open]") ||
          [],
      );
      if (details.length) {
        details.forEach((d) => (d.open = false));
        details.at(-1)?.querySelector("summary")?.focus();
      } else {
        setOpen(false);
        button.current?.focus();
      }
    };
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("pointerdown", outside);
    addEventListener("keydown", escape);
    return () => {
      removeEventListener("scroll", scroll);
      removeEventListener("pointerdown", outside);
      removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <header
      ref={header}
      className={`showroom-nav ${compact ? "is-compact" : ""}`}
    >
      <Link
        className="showroom-brand"
        href="/"
        aria-label={`${brandConfig.wordmark} home`}
        onClick={closeMenus}
      >
        <BrandLogo tagline />
      </Link>
      <nav
        id="showroom-menu"
        className={`showroom-nav-links ${open ? "is-open" : ""}`}
        aria-label="Showroom navigation"
      >
        <Link
          href="/templates"
          aria-current={path === "/templates" ? "page" : undefined}
          className={path === "/templates" ? "is-active" : ""}
          onClick={closeMenus}
        >
          Templates
        </Link>
        {groups.map((group) => (
          <details
            className="universe-nav-group"
            key={group.label}
            onToggle={(e) => {
              const current = e.currentTarget;
              if (current.open)
                header.current
                  ?.querySelectorAll<HTMLDetailsElement>("details[open]")
                  .forEach((d) => {
                    if (d !== current) d.open = false;
                  });
            }}
          >
            <summary
              className={
                group.links.some(
                  ([, href]) => href.split("#")[0] === path && path !== "/",
                )
                  ? "is-active"
                  : ""
              }
            >
              {group.label}
              <ChevronDown size={13} />
            </summary>
            <div className="universe-nav-dropdown">
              <p>{group.description}</p>
              {group.links.map(([label, href, description]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    closeMenus();
                    if (href.startsWith("/templates#"))
                      window.dispatchEvent(
                        new CustomEvent("universe-category", {
                          detail: href.split("#")[1],
                        }),
                      );
                  }}
                  aria-current={path === href ? "page" : undefined}
                >
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          </details>
        ))}
        <Link
          className="mobile-contact-link"
          href="/#contact"
          onClick={closeMenus}
        >
          Let’s talk
        </Link>
      </nav>
      <Link className="showroom-nav-cta" href="/templates" onClick={closeMenus}>
        All templates <ArrowUpRight size={15} />
      </Link>
      <button
        ref={button}
        className="showroom-menu-button"
        aria-label={open ? "Close showroom menu" : "Open showroom menu"}
        aria-expanded={open}
        aria-controls="showroom-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}
