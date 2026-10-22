"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { restaurants } from "@/data/restaurants";
import UniverseNavigation from "@/components/showcase/UniverseNavigation";
import BrandReady from "@/components/brand/BrandReady";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
export default function RestaurantCategory() {
  const [filter, setFilter] = useState("all"),
    [mobile, setMobile] = useState(false),
    { switchRestaurant } = useAnimation();
  return (
    <main className="showroom restaurant-category">
      <BrandReady />
      <UniverseNavigation />
      <section className="restaurant-category-hero showroom-section">
        <div>
          <span className="showroom-kicker">
            KC Web Universe / Restaurants & Food
          </span>
          <h1>
            Six flavors.
            <br />
            Six digital experiences.
          </h1>
          <p>
            Explore cinematic restaurant websites where food, storytelling, and
            technology come together.
          </p>
          <p>
            Fine dining, a spice journey, a botanical café, coastal evenings and
            two very different biryani worlds. Six fictional brands. Six
            complete websites.
          </p>
          <a className="showroom-button" href="#restaurant-collection">
            Explore the six flavours ↓
          </a>
        </div>
        <div className="restaurant-category-stack">
          {restaurants.map((r, i) => (
            <Image
              unoptimized
              key={r.slug}
              src={`/assets/restaurants-food/previews/${r.slug}-desktop.webp`}
              width={1440}
              height={1000}
              alt={`${r.name} website preview`}
              style={{ "--restaurant-index": i } as React.CSSProperties}
            />
          ))}
        </div>
      </section>
      <section
        className="showroom-section restaurant-category-collection"
        id="restaurant-collection"
      >
        <div
          className="restaurant-category-filters"
          role="group"
          aria-label="Restaurant template styles"
        >
          {[
            ["all", "All six restaurants"],
            ["dining", "Dining & café"],
            ["biryani", "Biryani worlds"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <button aria-pressed={mobile} onClick={() => setMobile((v) => !v)}>
            {mobile ? "Desktop previews" : "Mobile previews"}
          </button>
        </div>
        <div className="restaurant-category-grid">
          {restaurants
            .filter(
              (r) =>
                filter === "all" ||
                (filter === "biryani"
                  ? r.slug.includes("biryani")
                  : !r.slug.includes("biryani")),
            )
            .map((r) => (
              <article key={r.slug}>
                <div
                  className={`restaurant-category-preview ${mobile ? "is-mobile" : ""}`}
                >
                  <Image
                    unoptimized
                    src={`/assets/restaurants-food/previews/${r.slug}-${mobile ? "mobile" : "desktop"}.webp`}
                    width={1440}
                    height={1000}
                    alt={`${r.name} ${mobile ? "mobile" : "desktop"} website screenshot`}
                  />
                </div>
                <small>
                  {r.kind} / Template {r.number}
                </small>
                <h2>{r.name}</h2>
                <p>{r.description}</p>
                <ul>
                  <li>
                    Interactive{" "}
                    {r.slug === "royal-biryani-house"
                      ? "copper handi"
                      : r.slug === "biryani-express"
                        ? "biryani bowl"
                        : r.slug === "greenbowl-cafe"
                          ? "bowl builder"
                          : "food & restaurant scene"}
                  </li>
                  <li>Smart QR menu · Demo cart & checkout</li>
                  <li>Owner & chefs · Gallery · Reservations</li>
                </ul>
                <button
                  className="showroom-text-link"
                  onClick={() =>
                    switchRestaurant(r.slug, `/restaurants-food/${r.slug}`)
                  }
                >
                  View live demo ↗
                </button>
              </article>
            ))}
        </div>
      </section>
      <section className="restaurant-category-features showroom-section">
        <div>
          <span className="showroom-kicker">
            A little more beneath the menu
          </span>
          <h2>
            From first glance
            <br />
            to the final order.
          </h2>
          <p>
            Explore actual 3D food sculptures, follow the biryani handi through
            its story, assemble a fresh bowl and choose a demo takeaway combo.
          </p>
          <Link
            className="showroom-text-link"
            href="/restaurants-food/royal-biryani-house"
          >
            Follow the royal handi ↗
          </Link>
        </div>
        <Image
          unoptimized
          src="/assets/restaurants-food/royal-biryani-house/food/dish-1.webp"
          width={900}
          height={650}
          alt="Fictional Hyderabadi chicken dum biryani"
        />
      </section>
      <section className="restaurant-category-qr showroom-section">
        <div>
          <h2>A menu in your hand.</h2>
          <ol>
            <li>Generate a real QR for a configured table.</li>
            <li>Open the menu and confirm the active table.</li>
            <li>Choose portions, extras and quantities.</li>
            <li>Review a local demo checkout.</li>
            <li>Follow the simulated kitchen status.</li>
          </ol>
          <p>
            All orders are fictional, with no payment or real kitchen
            transmission.
          </p>
          <Link
            className="showroom-button"
            href="/restaurants-food/urban-bistro/qr"
          >
            Try the QR menu studio ↗
          </Link>
        </div>
        <div className="restaurant-mobile-previews">
          {restaurants.slice(4).map((r) => (
            <Image
              unoptimized
              key={r.slug}
              src={`/assets/restaurants-food/previews/${r.slug}-mobile.webp`}
              width={390}
              height={844}
              alt={`${r.name} mobile ordering website preview`}
            />
          ))}
        </div>
      </section>
      <footer className="restaurant-category-footer showroom-section">
        <h2>Your next flavour of website.</h2>
        <p>
          Twenty complete template experiences. One place to find your next
          idea.
        </p>
        <WhatsAppLink message="Hi Chaitanya, I’m interested in a restaurant website with an interactive menu and ordering." />
        <Link href="/templates">Explore all 20 templates ↗</Link>
      </footer>
    </main>
  );
}
