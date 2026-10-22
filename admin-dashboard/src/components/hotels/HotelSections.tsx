import Link from "next/link";
import Image from "next/image";
import type { Hotel } from "@/data/hotels-resorts";
import { money } from "@/lib/booking";
export function HotelPicture({
  src,
  alt,
  priority = false,
  parallax = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  parallax?: boolean;
}) {
  return (
    <Image
      unoptimized
      width={1200}
      height={800}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      data-hotel-parallax={parallax || undefined}
    />
  );
}
export function Story({ hotel }: { hotel: Hotel }) {
  return (
    <section className="hotel-story hotel-wrap">
      <div data-hotel-reveal>
        <span className="hotel-kicker">The spirit of {hotel.name}</span>
        <h2>{hotel.storyTitle}</h2>
        <p>{hotel.story[0]}</p>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/about`}
        >
          Our story ↗
        </Link>
      </div>
      <figure data-hotel-reveal>
        <HotelPicture
          src={hotel.rooms[0].image}
          alt={hotel.rooms[0].name}
          parallax
        />
        <figcaption>Spaces designed for a different pace.</figcaption>
      </figure>
    </section>
  );
}
export function Stays({ hotel, all = false }: { hotel: Hotel; all?: boolean }) {
  return (
    <section className="hotel-stays hotel-wrap" id="stays">
      <div className="hotel-section-title" data-hotel-reveal>
        <div>
          <span className="hotel-kicker">Your private corner</span>
          <h2>
            {hotel.slug === "luxury-hotel"
              ? "A suite for every chapter."
              : hotel.slug === "mountain-retreat"
                ? "Come home to the mountain."
                : hotel.slug === "beach-resort"
                  ? "Life, a little closer to the water."
                  : "Stay somewhere extraordinary."}
          </h2>
        </div>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/rooms`}
        >
          All accommodations ↗
        </Link>
      </div>
      <div className="hotel-room-grid">
        {hotel.rooms.slice(0, all ? 4 : 3).map((room, i) => (
          <article key={room.slug} data-hotel-reveal>
            <Link
              className="hotel-room-image"
              href={`/hotels-resorts/${hotel.slug}/rooms/${room.slug}`}
            >
              <HotelPicture src={room.image} alt={room.name} />
              <span>0{i + 1} / Discover your stay ↗</span>
            </Link>
            <div className="hotel-room-meta">
              <span>
                {room.size} m² · Up to {room.capacity} guests
              </span>
              <span>From {money(room.rate)} / night*</span>
            </div>
            <h3>
              <Link href={`/hotels-resorts/${hotel.slug}/rooms/${room.slug}`}>
                {room.name} ↗
              </Link>
            </h3>
            <p>{room.description}</p>
          </article>
        ))}
      </div>
      <small>*Illustrative USD rates. Sample tax shown when booking.</small>
    </section>
  );
}
export function Experiences({
  hotel,
  all = false,
}: {
  hotel: Hotel;
  all?: boolean;
}) {
  return (
    <section className="hotel-experiences hotel-wrap">
      <div className="hotel-section-title" data-hotel-reveal>
        <div>
          <span className="hotel-kicker">Collect moments</span>
          <h2>Follow your curiosity.</h2>
        </div>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/experiences`}
        >
          Every experience ↗
        </Link>
      </div>
      <div className="hotel-experience-rail">
        {hotel.experiences.slice(0, all ? 5 : 3).map((e, i) => (
          <Link
            key={e.slug}
            href={`/hotels-resorts/${hotel.slug}/experiences/${e.slug}`}
            data-hotel-reveal
          >
            <HotelPicture src={e.image} alt={e.name} />
            <span className="hotel-kicker">
              0{i + 1} / {e.duration}
            </span>
            <h3>{e.name} ↗</h3>
            <p>{e.description}</p>
          </Link>
        ))}
      </div>
      <span className="hotel-rail-hint">
        Swipe or scroll sideways to explore →
      </span>
    </section>
  );
}
export function DiningWellness({
  hotel,
  wellness = false,
}: {
  hotel: Hotel;
  wellness?: boolean;
}) {
  return (
    <section className={`hotel-feature-band ${wellness ? "is-wellness" : ""}`}>
      <div className="hotel-feature-photo">
        <HotelPicture
          src={`/assets/hotels-resorts/${hotel.slug}/experiences/${wellness ? "wellness" : "dining"}.webp`}
          alt={wellness ? hotel.wellness.title : hotel.dining.name}
          parallax
        />
      </div>
      <div data-hotel-reveal>
        <span className="hotel-kicker">
          {wellness ? "The art of doing less" : "A table worth staying for"}
        </span>
        <h2>{wellness ? hotel.wellness.title : hotel.dining.name}</h2>
        <p>
          {wellness ? hotel.wellness.description : hotel.dining.description}
        </p>
        <Link
          className="hotel-text-link"
          href={`/hotels-resorts/${hotel.slug}/${wellness ? "wellness" : "dining"}`}
        >
          Discover {wellness ? "wellness" : "dining"} ↗
        </Link>
      </div>
    </section>
  );
}
export function Amenities({ hotel }: { hotel: Hotel }) {
  return (
    <section className="hotel-amenities hotel-wrap">
      <span className="hotel-kicker">Thoughtful, by nature</span>
      <h2>The details make the difference.</h2>
      <div>
        {hotel.amenities.map((a, i) => (
          <article key={a} data-hotel-reveal>
            <span>0{i + 1} / ✧</span>
            <h3>{a}</h3>
            <p>
              A considered part of the {hotel.name} concept, designed around
              your own pace.
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
export function FAQ({ hotel }: { hotel: Hotel }) {
  return (
    <section className="hotel-faq hotel-wrap">
      <span className="hotel-kicker">A few helpful details</span>
      <h2>Before you arrive.</h2>
      {hotel.faqs.map((f) => (
        <details key={f.q}>
          <summary>
            {f.q}
            <span>+</span>
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}
