"use client";
import { useState } from "react";
import Link from "next/link";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import Image from "next/image";
import { hotels } from "@/data/hotels-resorts";
import UniverseNavigation from "@/components/showcase/UniverseNavigation";
import BrandReady from "@/components/brand/BrandReady";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
export default function HotelCategory() {
  const [view, setView] = useState("desktop"),
    [filter, setFilter] = useState("all");
  const { switchHotel } = useAnimation();
  return (
    <main className="hotel-category showroom">
      <BrandReady />
      <UniverseNavigation />
      <section className="hotel-category-intro">
        <div>
          <span className="showroom-kicker">
            KC Web Universe / A new collection
          </span>
          <h1>
            Hotels &<br />
            <em>Resorts.</em>
          </h1>
          <p>
            Four destinations. Four entirely different ways to stay. Explore
            immersive property models, thoughtful spaces and a little
            hospitality, beautifully imagined.
          </p>
          <p>
            Fictional properties · Interactive demos · Designed by K. Chaitanya
          </p>
          <a href="#hotel-collection" className="showroom-text-link">
            Explore the collection ↓
          </a>
        </div>
        <figure>
          <Image
            unoptimized
            width={1200}
            height={800}
            src={hotels[0].hero}
            alt="Sunset over the Solara Cove resort concept"
            fetchPriority="high"
          />
        </figure>
      </section>
      <div
        className="hotel-category-tabs"
        role="group"
        aria-label="Hotel template filters"
      >
        {[
          ["all", "All four destinations"],
          ...hotels.map((h) => [h.slug, h.short]),
        ].map(([value, label]) => (
          <button
            aria-pressed={filter === value}
            key={value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="hotel-category-tabs"
        role="group"
        aria-label="Preview screen size"
      >
        {["desktop", "mobile"].map((v) => (
          <button aria-pressed={view === v} key={v} onClick={() => setView(v)}>
            {v === "desktop" ? "Desktop previews" : "Mobile previews"}
          </button>
        ))}
      </div>
      <section className="hotel-category-grid" id="hotel-collection">
        {hotels
          .filter((h) => filter === "all" || filter === h.slug)
          .map((h) => (
            <article className="hotel-category-card" key={h.slug}>
              <div className={`hotel-category-image ${view}`}>
                <Image
                  unoptimized
                  width={1200}
                  height={800}
                  src={`/assets/hotels-resorts/previews/${h.slug}-${view}.webp`}
                  alt={`${h.name} ${view} website preview`}
                  loading="lazy"
                />
              </div>
              <span className="showroom-kicker" style={{ marginTop: 22 }}>
                {h.short} / Template {h.number}
              </span>
              <h2>{h.name}</h2>
              <p>{h.description}</p>
              <p>
                {h.slug === "resort-paradise"
                  ? "Sunset storytelling · 3D tropical island · Private villas"
                  : h.slug === "luxury-hotel"
                    ? "Architectural model · Suite exploration · Evening dining"
                    : h.slug === "mountain-retreat"
                      ? "Seasonal trails · 3D alpine cabins · Forest wellness"
                      : "Ocean storytelling · 3D overwater villas · Lagoon experiences"}
              </p>
              <button
                className="showroom-text-link"
                onClick={() => switchHotel(h.slug, `/hotels-resorts/${h.slug}`)}
              >
                Explore live template ↗
              </button>
            </article>
          ))}
      </section>
      <section className="hotel-category-features">
        <span className="showroom-kicker">
          Beautiful experiences. Shared foundations.
        </span>
        <h2>More than a first impression.</h2>
        <div>
          {[
            [
              "Explore in 3D",
              "Rotate each property, change camera views and discover its spaces. An accessible guide carries every essential detail.",
            ],
            [
              "A complete guest journey",
              "Accommodation details, dining, wellness, offers, a gallery and clear guest information.",
            ],
            [
              "Thoughtful motion",
              "Four unique property introductions, shorter refresh signatures and scroll stories that respect reduced motion.",
            ],
            [
              "Try a stay",
              "A transparent local booking demo with date, guest, capacity and pricing checks. No payment or real reservation.",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="hotel-category-footer">
        <WhatsAppLink message="Hi Chaitanya, I’d like to discuss a hotel or resort website." />
        <Link href="/templates">
          ← All fourteen website templates & selected projects
        </Link>
        <Link href="/">✧ KC Web Universe</Link>
        <a
          href="https://chaitanya-portfolio-eight.vercel.app/"
          target="_blank"
          rel="noreferrer"
        >
          Designed & Developed by K. Chaitanya ↗
        </a>
      </footer>
    </main>
  );
}
