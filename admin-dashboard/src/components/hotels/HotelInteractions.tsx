"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Hotel } from "@/data/hotels-resorts";
import Link from "next/link";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import { enquiryMessage } from "@/lib/whatsapp";
import Image from "next/image";
export function Gallery({ hotel }: { hotel: Hotel }) {
  const images = [
    { src: hotel.hero, label: "The setting" },
    ...hotel.rooms.slice(0, 3).map((r) => ({ src: r.image, label: r.name })),
    ...["dining", "wellness", "adventure"].map((n) => ({
      src: `/assets/hotels-resorts/${hotel.slug}/experiences/${n}.webp`,
      label: n === "adventure" ? "Experiences" : n,
    })),
  ];
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    start = useRef(0),
    trigger = useRef<HTMLButtonElement | null>(null);
  const move = useCallback(
    (delta: number) =>
      setActive((i) => (i + delta + images.length) % images.length),
    [images.length],
  );
  useEffect(() => {
    const d = dialog.current;
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    d?.addEventListener("keydown", keyboard);
    return () => d?.removeEventListener("keydown", keyboard);
  }, [move]);
  return (
    <section className="hotel-gallery hotel-wrap">
      <span className="hotel-kicker">A closer look</span>
      <h2>Picture yourself here.</h2>
      <p>
        Generated photography of a fictional destination. Select a photograph to
        explore.
      </p>
      <div>
        {images.map((image, i) => (
          <button
            key={image.src}
            aria-label={`View ${image.label}`}
            onClick={(e) => {
              trigger.current = e.currentTarget;
              setActive(i);
              dialog.current?.showModal();
            }}
          >
            <Image
              unoptimized
              width={1200}
              height={800}
              src={image.src}
              alt={image.label}
              loading="lazy"
            />
            <span>{image.label} ↗</span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="hotel-lightbox"
        aria-label="Property photo gallery"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          className="hotel-lightbox-close"
          aria-label="Close gallery"
          onClick={() => dialog.current?.close()}
        >
          Close ×
        </button>
        <Image
          unoptimized
          width={1200}
          height={800}
          src={images[active].src}
          alt={images[active].label}
          onTouchStart={(e) => {
            start.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - start.current;
            if (Math.abs(dx) > 40) move(dx > 0 ? -1 : 1);
          }}
        />
        <div>
          <button aria-label="Previous photograph" onClick={() => move(-1)}>
            ←
          </button>
          <p>
            {active + 1} / {images.length} — {images[active].label}
          </p>
          <button aria-label="Next photograph" onClick={() => move(1)}>
            →
          </button>
        </div>
      </dialog>
    </section>
  );
}
export function SeasonalTrails({ hotel }: { hotel: Hotel }) {
  const [season, setSeason] = useState(0),
    [trail, setTrail] = useState(0);
  const seasons = ["Winter", "Spring", "Summer", "Autumn"],
    trails = [
      ["The forest loop", "2 km · Gentle · Illustrative route"],
      ["High meadow path", "4 km · Moderate · Illustrative route"],
      ["The evening lookout", "1 km · Gentle · Illustrative route"],
    ];
  return (
    <section className="hotel-trails hotel-wrap">
      <div>
        <span className="hotel-kicker">A different kind of day</span>
        <h2>
          Four seasons.
          <br />A thousand reasons.
        </h2>
        <div role="group" aria-label="Choose a season" className="hotel-tabs">
          {seasons.map((s, i) => (
            <button
              key={s}
              aria-pressed={season === i}
              onClick={() => setSeason(i)}
            >
              {s}
            </button>
          ))}
        </div>
        <p aria-live="polite">
          {
            [
              "Quiet snow, fireside evenings and crisp mountain light.",
              "Fresh trails, open meadows and the first signs of green.",
              "Long days for alpine walks, cycling and cool-water pauses.",
              "Copper leaves, soft light and a slower forest rhythm.",
            ][season]
          }
        </p>
        <Image
          unoptimized
          width={1200}
          height={800}
          className={`hotel-season-image season-${season}`}
          src={
            season === 0
              ? hotel.hero
              : `/assets/hotels-resorts/${hotel.slug}/experiences/adventure.webp`
          }
          alt={`${seasons[season]} alpine concept`}
        />
      </div>
      <div className="hotel-trail-map">
        <span className="hotel-kicker">
          Illustrative trail guide · not a navigation map
        </span>
        <svg
          viewBox="0 0 500 360"
          role="img"
          aria-label="Illustrative paths between cabin, forest and mountain lookout"
        >
          <path
            d="M0 300 Q100 150 170 210 T350 100 T500 140 M0 260 Q120 60 230 145 T500 80 M0 330 Q200 270 270 300 T500 190"
            fill="none"
            stroke="currentColor"
            opacity=".12"
          />
          <path
            className="hotel-trail-line"
            d="M80 290 Q170 300 220 210 T350 120 T430 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="550"
            strokeDashoffset="550"
          />
          {[
            [80, 290],
            [220, 210],
            [350, 120],
          ].map(([x, y], i) => (
            <g
              key={i}
              onClick={() => setTrail(i)}
              role="button"
              tabIndex={0}
              aria-label={`Show ${trails[i][0]}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setTrail(i);
                }
              }}
            >
              <circle
                cx={x}
                cy={y}
                r="22"
                fill={trail === i ? "#a47753" : "#19372c"}
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fill="white"
                fontSize="13"
              >
                0{i + 1}
              </text>
            </g>
          ))}
        </svg>
        <div className="hotel-tabs">
          {trails.map(([name], i) => (
            <button
              aria-pressed={trail === i}
              onClick={() => setTrail(i)}
              key={name}
            >
              {name}
            </button>
          ))}
        </div>
        <h3 aria-live="polite">{trails[trail][0]}</h3>
        <p>{trails[trail][1]}</p>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/experiences`}
        >
          Plan an outdoor day ↗
        </Link>
      </div>
    </section>
  );
}
export function SuiteTour({ hotel }: { hotel: Hotel }) {
  const [view, setView] = useState(0);
  const views = ["The bedroom", "The living room", "The bathing suite"];
  return (
    <section className="hotel-suite-tour hotel-wrap">
      <div>
        <span className="hotel-kicker">
          The grand city suite / Interactive room views
        </span>
        <h2>
          Step into
          <br />
          your sanctuary.
        </h2>
        <p>Explore three thoughtfully designed spaces in our suite concept.</p>
        <div role="group" aria-label="Suite views" className="hotel-tabs">
          {views.map((v, i) => (
            <button
              key={v}
              aria-pressed={i === view}
              onClick={() => setView(i)}
            >
              0{i + 1} {v}
            </button>
          ))}
        </div>
        <p aria-live="polite">
          {
            [
              "A king bedroom, quiet textures and the city beyond.",
              "An intimate lounge with space for a longer conversation.",
              "A sculptural stone bath and a view to remember.",
            ][view]
          }
        </p>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/rooms/${hotel.rooms[0].slug}`}
        >
          Suite details ↗
        </Link>
      </div>
      <figure>
        <Image
          unoptimized
          width={1200}
          height={800}
          src={hotel.rooms[view].image}
          alt={views[view]}
        />
        <figcaption>{views[view]} · Illustrative suite photography</figcaption>
      </figure>
    </section>
  );
}
export function Contact({ hotel }: { hotel: Hotel }) {
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", message: "" });
  return (
    <section className="hotel-contact hotel-wrap">
      <div>
        <span className="hotel-kicker">Let’s imagine your stay</span>
        <h2>
          A personal
          <br />
          conversation.
        </h2>
        <p>
          {hotel.location}. This property is a fictional template, so there is
          no physical address or real hotel contact.
        </p>
        <p>For website enquiries, contact the designer:</p>
        <a
          className="hotel-text-link"
          href="mailto:kattachaitanya507@gmail.com"
        >
          kattachaitanya507@gmail.com ↗
        </a>
        <p>
          <a href="tel:+918367048538">+91 83670 48538</a>
        </p>
        <Link href={`/hotels-resorts/${hotel.slug}/faq`}>
          Guest questions ↗
        </Link>
      </div>
      <form
        onChange={(e) => {
          const data = new FormData(e.currentTarget);
          setDraft({
            name: String(data.get("name") || ""),
            email: String(data.get("email") || ""),
            message: String(data.get("message") || ""),
          });
        }}
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <label>
          Your name
          <input name="name" required autoComplete="name" maxLength={100} />
        </label>
        <label>
          Email address
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Your message
          <textarea name="message" required rows={5} maxLength={1500} />
        </label>
        <p>
          Form demonstration only. Your message stays in this browser and is not
          sent.
        </p>
        <button className="hotel-button">Preview demo enquiry ↗</button>
        <WhatsAppLink
          message={enquiryMessage(`${hotel.name} website template`, draft)}
          label="Continue enquiry in WhatsApp"
        />
        <p>
          WhatsApp opens a real conversation with the website designer at +91
          83670 48538. Your typed message is prefilled; you choose when to send.
        </p>
        {sent && (
          <p role="status">
            Your demo enquiry is complete. Nothing has been sent or stored. Use
            the designer’s email link for a real website enquiry.
          </p>
        )}
      </form>
    </section>
  );
}
