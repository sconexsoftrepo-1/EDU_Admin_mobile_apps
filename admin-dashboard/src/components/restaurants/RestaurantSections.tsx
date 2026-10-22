"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Restaurant } from "@/data/restaurants";
export function OwnerStory({ restaurant: r }: { restaurant: Restaurant }) {
  return (
    <section className="food-owner food-wrap">
      <div className="food-owner-portrait">
        <Image
          unoptimized
          src={r.owner.image}
          width={600}
          height={800}
          alt={`${r.owner.name}, generated fictional founder portrait`}
        />
        <span>Fictional founder / Generated portrait</span>
      </div>
      <div>
        <small>Our story begins in {r.year} · Demo narrative</small>
        <h2>
          {r.slug === "royal-biryani-house"
            ? "A legacy around the handi."
            : r.slug === "greenbowl-cafe"
              ? "Small beginnings. Bright ideas."
              : r.slug === "biryani-express"
                ? "A little kitchen. A big appetite."
                : "A place with a point of view."}
        </h2>
        <p>{r.story[0]}</p>
        <blockquote>“{r.owner.quote}”</blockquote>
        <h3>{r.owner.name}</h3>
        <p>{r.owner.bio}</p>
        <Link
          className="food-text-link"
          href={`/restaurants-food/${r.slug}/about`}
        >
          Explore our fictional story ↗
        </Link>
      </div>
    </section>
  );
}
export function ChefStories({
  restaurant: r,
  full = false,
}: {
  restaurant: Restaurant;
  full?: boolean;
}) {
  return (
    <section className="food-chefs food-wrap">
      <div className="food-section-heading">
        <div>
          <small>The people behind the plates</small>
          <h2>
            {r.slug === "biryani-express"
              ? "Big flavours. Different talents."
              : "Made with a little personality."}
          </h2>
        </div>
        <p>
          Fictional chef profiles and generated portraits. No real awards or
          qualifications are claimed.
        </p>
      </div>
      <div className="food-chef-grid">
        {r.chefs.map((c, i) => (
          <article key={c.name}>
            <figure>
              <Image
                unoptimized
                src={c.image}
                width={600}
                height={800}
                alt={`${c.name}, fictional ${c.role.toLowerCase()}`}
              />
              <figcaption>{c.specialty}</figcaption>
            </figure>
            <small>{c.role}</small>
            <h3>{c.name}</h3>
            <p>{c.specialty}</p>
            {full ? (
              <>
                <p>{c.bio}</p>
                <h4>Signature dishes</h4>
                <ul>
                  {r.menu.slice(i * 3, i * 3 + 3).map((d) => (
                    <li key={d.slug}>
                      <Link href={`/restaurants-food/${r.slug}/menu/${d.slug}`}>
                        {d.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link
                className="food-text-link"
                href={`/restaurants-food/${r.slug}/our-chefs`}
              >
                Meet the kitchen team ↗
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
export function BuildingStory({ restaurant: r }: { restaurant: Restaurant }) {
  const [view, setView] = useState(0),
    images = [r.hero, r.interior, r.tableImage, r.kitchen],
    labels = ["The entrance", "Dining room", "At the table", "The kitchen"];
  return (
    <section className="food-building food-wrap">
      <div className="food-building-image">
        <Image
          unoptimized
          key={view}
          src={images[view]}
          width={1400}
          height={900}
          alt={`${r.name} fictional ${labels[view].toLowerCase()}`}
        />
        <span>Generated fictional architecture & interiors</span>
      </div>
      <div className="food-building-caption">
        <div>
          <small>{r.kind}</small>
          <h2>
            {r.slug === "greenbowl-cafe"
              ? "A little room to grow."
              : r.slug === "ocean-grill"
                ? "An evening by the water."
                : "Come for the food. Stay for the feeling."}
          </h2>
          <p>{r.story[1]}</p>
        </div>
        <div role="group" aria-label="Restaurant spaces">
          {labels.map((label, i) => (
            <button
              key={label}
              aria-pressed={view === i}
              onClick={() => setView(i)}
            >
              <b>0{i + 1}</b>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
export function FoodFAQ({
  restaurant: r,
  preview = false,
}: {
  restaurant: Restaurant;
  preview?: boolean;
}) {
  return (
    <section className="food-faq food-wrap">
      <h2>A little clarity before your visit.</h2>
      {r.faq.slice(0, preview ? 3 : undefined).map((f) => (
        <details key={f.q}>
          <summary>
            {f.q}
            <span>+</span>
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
      {preview && (
        <Link
          className="food-text-link"
          href={`/restaurants-food/${r.slug}/faq`}
        >
          View all questions ↗
        </Link>
      )}
    </section>
  );
}
export function FoodGallery({
  restaurant: r,
  preview = false,
}: {
  restaurant: Restaurant;
  preview?: boolean;
}) {
  const [filter, setFilter] = useState("All"),
    [index, setIndex] = useState(0),
    dialog = useRef<HTMLDialogElement>(null),
    last = useRef<HTMLButtonElement | null>(null),
    touch = useRef(0);
  const images = [
      { image: r.hero, name: "Exterior", category: "Spaces" },
      { image: r.interior, name: "Dining room", category: "Spaces" },
      { image: r.tableImage, name: "Table setting", category: "Spaces" },
      { image: r.kitchen, name: "Kitchen", category: "Spaces" },
      ...r.menu.map((d) => ({
        image: d.image,
        name: d.name,
        category: "Food",
      })),
      ...r.chefs.map((c) => ({
        image: c.image,
        name: c.name,
        category: "People",
      })),
    ],
    visible = images.filter((p) => filter === "All" || p.category === filter),
    current = visible[index] || visible[0];
  const move = (i: number) => setIndex((i + visible.length) % visible.length);
  return (
    <section className="food-gallery food-wrap">
      <div className="food-section-heading">
        <div>
          <small>A few moments from this world</small>
          <h2>{preview ? "Take a little look around." : "The gallery."}</h2>
        </div>
        <p>Generated images of fictional spaces, dishes and people.</p>
      </div>
      {!preview && (
        <div
          role="group"
          aria-label="Gallery categories"
          className="food-gallery-tabs"
        >
          {["All", "Spaces", "Food", "People"].map((c) => (
            <button
              key={c}
              aria-pressed={filter === c}
              onClick={() => {
                setFilter(c);
                setIndex(0);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      <div className={preview ? "food-gallery-preview" : "food-gallery-grid"}>
        {visible.slice(0, preview ? 4 : undefined).map((p, i) => (
          <button
            key={p.name}
            onClick={(e) => {
              last.current = e.currentTarget;
              setIndex(i);
              dialog.current?.showModal();
            }}
            aria-label={`View ${p.name}`}
          >
            <Image
              unoptimized
              src={p.image}
              width={700}
              height={500}
              alt={p.name}
            />
            <span>{p.name} ↗</span>
          </button>
        ))}
      </div>
      <dialog
        className="food-lightbox"
        ref={dialog}
        aria-label="Restaurant gallery"
        onClose={() => last.current?.focus()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(index + 1);
          if (e.key === "ArrowLeft") move(index - 1);
        }}
      >
        <button
          aria-label="Close gallery"
          onClick={() => dialog.current?.close()}
        >
          ✕
        </button>
        <div
          onTouchStart={(e) => {
            touch.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(delta) > 40) move(index + (delta < 0 ? 1 : -1));
          }}
        >
          <Image
            unoptimized
            src={current.image}
            width={1400}
            height={1000}
            alt={current.name}
          />
          <p>{current.name} · Generated fictional image</p>
        </div>
        <div className="food-lightbox-controls">
          <button
            onClick={() => move(index - 1)}
            aria-label="Previous gallery image"
          >
            ←
          </button>
          <span>
            {index + 1} / {visible.length}
          </span>
          <button
            onClick={() => move(index + 1)}
            aria-label="Next gallery image"
          >
            →
          </button>
        </div>
      </dialog>
    </section>
  );
}
export function LocationStory({ restaurant: r }: { restaurant: Restaurant }) {
  const [active, setActive] = useState(0);
  return (
    <section className="food-location food-wrap">
      <div>
        <small>Imagine the setting</small>
        <h2>
          {r.slug === "biryani-express"
            ? "A neighbourhood kind of energy."
            : "Find a moment at our table."}
        </h2>
        <p>
          These locations are fictional demo concepts. No real street address,
          branch, phone number or directions are claimed.
        </p>
        <div
          className="food-location-options"
          role="group"
          aria-label="Fictional restaurant locations"
        >
          {r.locations.map((l, i) => (
            <button
              key={l.name}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              {l.name}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <h3>{r.locations[active].name}</h3>
          <p>{r.locations[active].description}</p>
        </div>
        <ul>
          {r.hours.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
      <Image
        unoptimized
        src={r.entrance}
        width={800}
        height={650}
        alt={`${r.name} fictional entrance`}
      />
    </section>
  );
}
