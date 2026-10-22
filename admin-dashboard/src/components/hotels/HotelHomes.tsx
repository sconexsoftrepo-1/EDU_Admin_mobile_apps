import Link from "next/link";
import type { Hotel } from "@/data/hotels-resorts";
import {
  HotelPicture,
  Story,
  Stays,
  Experiences,
  DiningWellness,
  FAQ,
} from "./HotelSections";
import PropertyGuide from "./PropertyGuide";
import { SeasonalTrails, SuiteTour } from "./HotelInteractions";
const base = (h: Hotel) => `/hotels-resorts/${h.slug}`;
function Actions({ hotel }: { hotel: Hotel }) {
  return (
    <div className="hotel-hero-actions">
      <Link className="hotel-button" href={`${base(hotel)}/booking`}>
        Book your escape ↗
      </Link>
      <a className="hotel-ghost-button" href="#property">
        Explore the property ↓
      </a>
    </div>
  );
}
export function ResortHome({ hotel }: { hotel: Hotel }) {
  return (
    <>
      <section className="hotel-hero resort-hero">
        <picture>
          <source media="(max-width:600px)" srcSet={hotel.mobileHero} />
          <HotelPicture
            src={hotel.hero}
            alt="Sunset over an infinity pool and tropical sea villas"
            priority
            parallax
          />
        </picture>
        <div className="hotel-hero-copy">
          <span className="hotel-kicker">
            Solara Cove / A slower kind of luxury
          </span>
          <h1>
            Where every sunset
            <br />
            feels <em>extraordinary.</em>
          </h1>
          <p>{hotel.description}</p>
          <Actions hotel={hotel} />
        </div>
        <div className="resort-hero-note">
          <span>01 / Arrive. Exhale. Stay awhile.</span>
          <a href="#story">Follow the light ↓</a>
        </div>
      </section>
      <div className="hotel-quick-book hotel-wrap">
        <span>Find a little time for yourself.</span>
        <div>
          Private villas <b>✧</b> Open horizons <b>✧</b> Unhurried days
        </div>
        <Link href={`${base(hotel)}/booking`}>Check demo availability ↗</Link>
      </div>
      <div id="story">
        <Story hotel={hotel} />
      </div>
      <PropertyGuide hotel={hotel} />
      <Stays hotel={hotel} />
      <DiningWellness hotel={hotel} />
      <Experiences hotel={hotel} />
      <DiningWellness hotel={hotel} wellness />
      <FAQ hotel={hotel} />
    </>
  );
}
export function LuxuryHome({ hotel }: { hotel: Hotel }) {
  return (
    <>
      <section className="hotel-hero luxury-hero">
        <div className="luxury-side-index">
          AURELIA / A CONSIDERED CITY ADDRESS
        </div>
        <div className="hotel-hero-copy">
          <span className="hotel-kicker">
            The Aurelia Grand · An imagined city address
          </span>
          <h1>
            An exceptional stay.
            <br />
            <em>A timeless address.</em>
          </h1>
          <p>{hotel.description}</p>
          <Actions hotel={hotel} />
          <div className="luxury-hero-foot">
            <span>
              Architecture.
              <br />
              Art. Atmosphere.
            </span>
            <span>
              Discover a different
              <br />
              perspective on the city.
            </span>
          </div>
        </div>
        <figure>
          <HotelPicture
            src={hotel.hero}
            alt="Bronze illuminated architecture of a luxury city hotel"
            priority
            parallax
          />
          <figcaption>THE AURELIA GRAND / AFTER DARK</figcaption>
        </figure>
      </section>
      <Story hotel={hotel} />
      <SuiteTour hotel={hotel} />
      <Stays hotel={hotel} />
      <PropertyGuide hotel={hotel} />
      <DiningWellness hotel={hotel} />
      <Experiences hotel={hotel} />
      <DiningWellness hotel={hotel} wellness />
      <FAQ hotel={hotel} />
    </>
  );
}
export function MountainHome({ hotel }: { hotel: Hotel }) {
  return (
    <>
      <section className="hotel-hero mountain-hero">
        <div className="mountain-hero-masthead">
          <span className="hotel-kicker">Cabin warmth. Mountain quiet.</span>
          <span>Northpine / An imagined alpine valley</span>
        </div>
        <h1>
          Find your place
          <br />
          <em>above the ordinary.</em>
        </h1>
        <figure>
          <HotelPicture
            src={hotel.hero}
            alt="Warm timber cabin overlooking a snow-covered alpine valley"
            priority
            parallax
          />
          <figcaption>Less noise. More nature.</figcaption>
        </figure>
        <div className="mountain-hero-bottom">
          <p>{hotel.description}</p>
          <Actions hotel={hotel} />
        </div>
      </section>
      <Story hotel={hotel} />
      <SeasonalTrails hotel={hotel} />
      <Stays hotel={hotel} />
      <PropertyGuide hotel={hotel} />
      <DiningWellness hotel={hotel} wellness />
      <Experiences hotel={hotel} />
      <DiningWellness hotel={hotel} />
      <FAQ hotel={hotel} />
    </>
  );
}
export function BeachHome({ hotel }: { hotel: Hotel }) {
  return (
    <>
      <section className="hotel-hero beach-hero">
        <div className="hotel-hero-copy">
          <span className="hotel-kicker">
            Azure Tide Villas / Good days, on island time
          </span>
          <h1>
            Your paradise
            <br />
            <em>begins here.</em>
          </h1>
          <p>{hotel.description}</p>
          <Actions hotel={hotel} />
          <div className="beach-conditions">
            <span>☀ 28°C · Calm lagoon</span>
            <small>Illustrative conditions · Sample data</small>
          </div>
        </div>
        <figure>
          <HotelPicture
            src={hotel.hero}
            alt="Turquoise lagoon and overwater villas with private decks"
            priority
            parallax
          />
          <figcaption>A little closer to the blue.</figcaption>
        </figure>
        <span className="beach-hero-mark" aria-hidden="true">
          AT
        </span>
      </section>
      <section className="hotel-ocean-story">
        <span className="hotel-ocean-fish" aria-hidden="true">
          ⋖
        </span>
        <span className="hotel-ocean-fish" aria-hidden="true">
          ⋖
        </span>
        <span className="hotel-kicker">
          From below the surface to your private deck
        </span>
        <h2 data-hotel-reveal>
          A whole world
          <br />
          <em>in every shade of blue.</em>
        </h2>
        <p data-hotel-reveal>
          The lagoon is the beginning of the story. Discover the villa, the
          shore and the moments in between.
        </p>
        <a className="hotel-ghost-button" href="#property">
          Explore above the water ↓
        </a>
      </section>
      <PropertyGuide hotel={hotel} />
      <Stays hotel={hotel} />
      <Story hotel={hotel} />
      <Experiences hotel={hotel} />
      <DiningWellness hotel={hotel} />
      <DiningWellness hotel={hotel} wellness />
      <FAQ hotel={hotel} />
    </>
  );
}
