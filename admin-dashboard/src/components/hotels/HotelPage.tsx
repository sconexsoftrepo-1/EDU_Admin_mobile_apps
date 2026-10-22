import { Suspense } from "react";
import Link from "next/link";
import type { Hotel } from "@/data/hotels-resorts";
import {
  HotelPicture,
  Story,
  Stays,
  Experiences,
  DiningWellness,
  Amenities,
  FAQ,
} from "./HotelSections";
import {
  Gallery,
  Contact,
  SuiteTour,
  SeasonalTrails,
} from "./HotelInteractions";
import Booking from "./Booking";
import PropertyGuide from "./PropertyGuide";
import { money } from "@/lib/booking";
const titles: Record<string, [string, string]> = {
  about: ["Our story", "A sense of place. A different pace."],
  rooms: ["Your private corner", "Considered spaces. Memorable stays."],
  experiences: ["Collect moments", "Follow your curiosity."],
  dining: ["From our table", "Time, beautifully shared."],
  wellness: [
    "Pause. Breathe. Reconnect.",
    "The art of feeling a little more yourself.",
  ],
  amenities: ["The thoughtful details", "A stay shaped around you."],
  gallery: [
    "Through a different lens",
    "A little inspiration for your next escape.",
  ],
  offers: [
    "A little more possibility",
    "Good reasons to stay a little longer.",
  ],
  booking: ["Plan your stay", "Make room for something extraordinary."],
  contact: ["A personal welcome", "Let’s imagine your next stay."],
  faq: ["Before you arrive", "A few helpful details."],
};
export default function HotelPage({
  hotel,
  parts,
}: {
  hotel: Hotel;
  parts: string[];
}) {
  const [page, detail] = parts;
  const room =
    page === "rooms" ? hotel.rooms.find((r) => r.slug === detail) : null;
  const experience =
    page === "experiences"
      ? hotel.experiences.find((e) => e.slug === detail)
      : null;
  const title = room?.name || experience?.name || titles[page]?.[1];
  const base = `/hotels-resorts/${hotel.slug}`;
  return (
    <>
      <section className={`hotel-page-heading ${detail ? "has-detail" : ""}`}>
        <div className="hotel-wrap">
          <Link className="hotel-kicker" href={base}>
            {hotel.name} / {page}
          </Link>
          <h1>{title}</h1>
          <p>
            {room?.description || experience?.description || titles[page]?.[0]}
          </p>
          {page === "rooms" && !detail && (
            <a className="hotel-text-link" href="#stays">
              Discover your accommodation ↓
            </a>
          )}
        </div>
        {detail && (
          <div className="hotel-detail-hero">
            <HotelPicture
              src={room?.image || experience?.image || hotel.hero}
              alt={title}
              priority
              parallax
            />
          </div>
        )}
      </section>
      {room ? (
        <>
          <section className="hotel-room-detail hotel-wrap">
            <div>
              <span className="hotel-kicker">
                Designed to feel like your own
              </span>
              <h2>Settle in. Stay awhile.</h2>
              <p>{room.description}</p>
              <div className="hotel-room-facts">
                <span>{room.size} m² of space</span>
                <span>Up to {room.capacity} guests</span>
                <span>{room.beds}</span>
              </div>
              <h3>Your room, thoughtfully considered</h3>
              <ul>
                {room.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <h3>Included in this sample stay</h3>
              <ul>
                {room.included.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <h3>Changes & cancellation</h3>
              <p>{room.cancellation}</p>
            </div>
            <aside>
              <span className="hotel-kicker">Your escape awaits</span>
              <h3>
                From {money(room.rate)}
                <small> / night</small>
              </h3>
              <p>
                USD sample rate · {hotel.taxRate * 100}% sample tax calculated
                in your summary.
              </p>
              <Link
                className="hotel-button"
                href={`${base}/booking?room=${room.slug}`}
              >
                Check this accommodation ↗
              </Link>
              <p>Local demo. No real reservation or payment.</p>
            </aside>
          </section>
          {hotel.slug === "luxury-hotel" && <SuiteTour hotel={hotel} />}
          <Gallery hotel={hotel} />
        </>
      ) : experience ? (
        <section className="hotel-experience-detail hotel-wrap">
          <span className="hotel-kicker">
            {experience.duration} / {hotel.name}
          </span>
          <h2>A moment to make your own.</h2>
          <p>{experience.detail}</p>
          <h3>A sample itinerary</h3>
          <ol>
            <li>Meet your host and discover the setting.</li>
            <li>Explore the experience at a comfortable pace.</li>
            <li>Pause, reflect and return when you’re ready.</li>
          </ol>
          <p>
            Illustrative activity. No real booking, schedule or safety guidance
            is provided.
          </p>
          <Link className="hotel-button" href={`${base}/booking`}>
            Pair it with a demo stay ↗
          </Link>
        </section>
      ) : (
        <>
          {page === "about" && (
            <>
              <Story hotel={hotel} />
              <section className="hotel-wrap hotel-about-values">
                <span className="hotel-kicker">Our approach</span>
                <h2>Personal. Considered. Connected.</h2>
                <p>{hotel.story[1]}</p>
                <div>
                  {[
                    "A sense of place",
                    "Room to reconnect",
                    "Thoughtful by nature",
                  ].map((v, i) => (
                    <article key={v}>
                      <span>0{i + 1}</span>
                      <h3>{v}</h3>
                      <p>
                        {
                          [
                            hotel.description,
                            hotel.wellness.description,
                            hotel.dining.description,
                          ][i]
                        }
                      </p>
                    </article>
                  ))}
                </div>
              </section>
              <PropertyGuide hotel={hotel} />
            </>
          )}
          {page === "rooms" && <Stays hotel={hotel} all />}
          {page === "experiences" && (
            <>
              <Experiences hotel={hotel} all />
              {hotel.slug === "mountain-retreat" && (
                <SeasonalTrails hotel={hotel} />
              )}
            </>
          )}
          {(page === "dining" || page === "wellness") && (
            <>
              <DiningWellness hotel={hotel} wellness={page === "wellness"} />
              <section className="hotel-menu-list hotel-wrap">
                <span className="hotel-kicker">
                  {page === "dining"
                    ? "A taste of the concept"
                    : "Find your ritual"}
                </span>
                <h2>
                  {page === "dining"
                    ? "Simple pleasures, beautifully made."
                    : "Time well spent."}
                </h2>
                {(page === "dining"
                  ? hotel.dining.menu
                  : hotel.wellness.treatments
                ).map((item, i) => (
                  <article key={item}>
                    <span>0{i + 1}</span>
                    <h3>{item}</h3>
                    <p>
                      {page === "dining"
                        ? "A seasonal sample menu. Preferences and dietary needs can be part of a real property implementation."
                        : "A sample wellness ritual. This is a hospitality design concept; no treatment is provided."}
                    </p>
                  </article>
                ))}
                <p>
                  Concept menu and schedules only. No real service availability.
                </p>
                <Link className="hotel-text-link" href={`${base}/contact`}>
                  Ask about the concept ↗
                </Link>
              </section>
            </>
          )}
          {page === "amenities" && (
            <>
              <Amenities hotel={hotel} />
              <PropertyGuide hotel={hotel} />
            </>
          )}
          {page === "gallery" && <Gallery hotel={hotel} />}
          {page === "offers" && (
            <section className="hotel-offers hotel-wrap">
              {hotel.offers.map((o, i) => (
                <article key={o.title}>
                  <HotelPicture
                    src={hotel.rooms[i].image}
                    alt={hotel.rooms[i].name}
                  />
                  <div>
                    <span className="hotel-kicker">
                      A little more time / 0{i + 1}
                    </span>
                    <h2>{o.title}</h2>
                    <p>{o.description}</p>
                    <p>
                      Minimum {o.minimumNights} nights. Sample availability and
                      room-capacity rules apply. No real offer or reservation.
                    </p>
                    <Link
                      className="hotel-button"
                      href={`${base}/booking?offer=${i}`}
                    >
                      Explore this sample offer ↗
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}
          {page === "booking" && (
            <Suspense fallback={<p>Preparing the booking form…</p>}>
              <div className="hotel-wrap">
                <Booking hotel={hotel} />
              </div>
            </Suspense>
          )}
          {page === "contact" && <Contact hotel={hotel} />}
          {page === "faq" && <FAQ hotel={hotel} />}
        </>
      )}
    </>
  );
}
