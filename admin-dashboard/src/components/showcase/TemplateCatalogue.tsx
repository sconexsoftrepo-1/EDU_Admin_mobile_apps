"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import {
  templateCategories,
  universeTemplates,
} from "@/data/templateCatalogue";
import UniverseNavigation from "./UniverseNavigation";
import { whatsappUrl } from "@/lib/whatsapp";
import { developerContact } from "@/data/developerContact";
import BrandReady from "../brand/BrandReady";
import { useAnimation } from "../animation-system/AnimationProvider";
import type { AnimationTemplateId } from "../animation-system/config/animationRegistry";
export default function TemplateCatalogue() {
  const router = useRouter();
  const [category, setCategory] = useState("all"),
    [query, setQuery] = useState("");
  useEffect(() => {
    let frame = 0;
    const chooseCategory = (raw: string) => {
      const id = raw || "all";
      if (id !== "all" && !templateCategories.some((c) => c.id === id)) return;
      setCategory(id);
      setQuery("");
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        document
          .getElementById(id === "all" ? "catalogue-top" : id)
          ?.scrollIntoView({ block: "start" }),
      );
    };
    const hash = () => chooseCategory(location.hash.slice(1));
    const select = (event: Event) =>
      chooseCategory((event as CustomEvent<string>).detail);
    if (location.hash) frame = requestAnimationFrame(hash);
    addEventListener("hashchange", hash);
    addEventListener("universe-category", select);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("hashchange", hash);
      removeEventListener("universe-category", select);
    };
  }, []);
  const { switchTemplate, switchHotel, switchSchool, switchRestaurant } =
    useAnimation();
  const match = (item: (typeof universeTemplates)[number]) =>
    `${item.title} ${item.category} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase());
  const groups = templateCategories
    .filter((c) =>
      category === "all"
        ? c.items.some((item) => !item.external)
        : category === "projects"
          ? c.items.every((item) => item.external)
          : category === c.id,
    )
    .map((c) => ({ ...c, items: c.items.filter(match) }));
  const count = groups.reduce((n, c) => n + c.items.length, 0);
  return (
    <main className="showroom universe-catalogue">
      <BrandReady />
      <UniverseNavigation />
      <section className="catalogue-intro showroom-section" id="catalogue-top">
        <span className="showroom-kicker">The template universe</span>
        <h1>
          Find your world.
          <br />
          Make it yours.
        </h1>
        <p>
          Twenty-two website templates across dental care, hotels, schools and
          restaurants and colleges, plus selected healthcare, commerce and
          portfolio project examples.
        </p>
        <div className="catalogue-toolbar">
          <div role="group" aria-label="Template categories">
            {[
              { id: "all", short: "All templates" },
              { id: "projects", short: "Selected projects" },
              ...templateCategories,
            ].map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.short}
              </button>
            ))}
          </div>
          <label>
            <Search size={18} />
            <span className="sr-only">Search website templates</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the universe"
            />
          </label>
        </div>
        <p className="catalogue-result-count" role="status">
          {count} {count === 1 ? "experience" : "experiences"} to explore
        </p>
      </section>
      {groups
        .filter((c) => c.items.length)
        .map((c) => (
          <section
            id={c.id}
            key={c.id}
            className="catalogue-category showroom-section"
            style={{ "--category-accent": c.accent } as React.CSSProperties}
          >
            <div className="catalogue-category-title">
              <div>
                <h2>{c.title}</h2>
                <p>{c.description}</p>
              </div>
              <span>{String(c.items.length).padStart(2, "0")}</span>
            </div>
            <div className="catalogue-template-grid">
              {c.items.map((item) => (
                <article key={item.id} className="catalogue-template">
                  <div className="catalogue-template-image">
                    <Image
                      unoptimized
                      src={item.image}
                      fill
                      sizes="(max-width:700px) 90vw, 45vw"
                      alt={`${item.title} website preview`}
                    />
                  </div>
                  <div className="catalogue-template-caption">
                    <div>
                      <small>{item.category}</small>
                      <h3>{item.title}</h3>
                    </div>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Explore ${item.title}`}
                      >
                        <ArrowUpRight />
                      </a>
                    ) : (
                      <button
                        onClick={() =>
                          item.collegeSlug
                            ? router.push(item.href)
                            : item.restaurantSlug
                              ? switchRestaurant(item.restaurantSlug, item.href)
                              : item.schoolSlug
                                ? switchSchool(item.schoolSlug, item.href)
                                : item.hotelSlug
                                  ? switchHotel(item.hotelSlug, item.href)
                                  : switchTemplate(
                                      item.id as AnimationTemplateId,
                                      item.href,
                                    )
                        }
                        aria-label={`Explore ${item.title}`}
                      >
                        <ArrowUpRight />
                      </button>
                    )}
                  </div>
                  <p>{item.description}</p>
                  {item.external ? (
                    <a
                      className="showroom-text-link"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Explore live website <ArrowUpRight size={16} />
                    </a>
                  ) : (
                    <button
                      className="showroom-text-link"
                      onClick={() =>
                        item.restaurantSlug
                          ? switchRestaurant(item.restaurantSlug, item.href)
                          : item.schoolSlug
                            ? switchSchool(item.schoolSlug, item.href)
                            : item.hotelSlug
                              ? switchHotel(item.hotelSlug, item.href)
                              : switchTemplate(
                                  item.id as AnimationTemplateId,
                                  item.href,
                                )
                      }
                    >
                      Explore live website <ArrowUpRight size={16} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      {count === 0 && (
        <section className="showroom-section">
          <h2>No templates match that search.</h2>
          <button
            className="showroom-text-link"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
          >
            Show the whole collection
          </button>
        </section>
      )}
      <footer className="catalogue-footer showroom-section">
        <div className="catalogue-footer-intro">
          <span className="showroom-kicker">Your next idea starts here</span>
          <h2>
            Have a different
            <br />
            world in mind?
          </h2>
          <p>
            Let’s create a website or mobile experience that feels like you.
          </p>
          <Link href="/contact" className="showroom-button">
            Let’s build yours <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="catalogue-footer-contact">
          <span className="showroom-kicker">Let’s talk</span>
          <a href={developerContact.emailHref}>
            <small>Email me</small>
            <strong>{developerContact.email}</strong>
            <ArrowUpRight size={18} />
          </a>
          <a href={developerContact.phoneHref}>
            <small>Call me</small>
            <strong>{developerContact.phone}</strong>
            <ArrowUpRight size={18} />
          </a>
          <a
            className="catalogue-whatsapp"
            href={whatsappUrl()}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat on WhatsApp at +91 83670 48538"
          >
            <small>WhatsApp</small>
            <strong>Chat on +91 83670 48538</strong>
            <ArrowUpRight size={18} />
          </a>
          <a href={developerContact.portfolio} target="_blank" rel="noreferrer">
            <small>Explore more work</small>
            <strong>Chaitanya’s portfolio</strong>
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="catalogue-footer-bottom">
          <Link href="/">✧ KC Web Universe</Link>
          <span>{developerContact.signature}</span>
          <Link href="#catalogue-top">Back to templates ↑</Link>
        </div>
      </footer>
    </main>
  );
}
