"use client";
import { useEffect, useState } from "react";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
import { usePathname, useSearchParams } from "next/navigation";
import type { Hotel } from "@/data/hotels-resorts";
import {
  BookingError,
  demoBookingProvider,
  money,
  type BookingRequest,
  type BookingQuote,
} from "@/lib/booking";
export default function Booking({ hotel }: { hotel: Hotel }) {
  const params = useSearchParams();
  const path = usePathname();
  const { markReady } = useAnimation();
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => markReady(path, "01"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [path, markReady]);
  const [quote, setQuote] = useState<BookingQuote | null>(null),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setError("");
    setConfirmation("");
    setQuote(null);
    setPending(true);
    const request: BookingRequest = {
      checkIn: String(form.get("checkIn")),
      checkOut: String(form.get("checkOut")),
      adults: Number(form.get("adults")),
      children: Number(form.get("children")),
      rooms: Number(form.get("rooms")),
      roomSlug: String(form.get("roomSlug")),
      offer: form.get("offer") === "" ? undefined : Number(form.get("offer")),
    };
    try {
      setQuote(await demoBookingProvider.quote(hotel, request));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      if (e instanceof BookingError)
        document.getElementById(`booking-${e.field}`)?.focus();
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="hotel-booking" id="booking-form">
      <div>
        <span className="hotel-kicker">Make a little time</span>
        <h2>
          Your next stay,
          <br />
          <em>imagined.</em>
        </h2>
        <p>
          Explore sample availability and transparent pricing. This is a local
          demo. No reservation, payment or personal data is sent.
        </p>
        <small>All prices in USD · Sample tax {hotel.taxRate * 100}%</small>
      </div>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
          onChange={() => {
            setQuote(null);
            setConfirmation("");
            setError("");
          }}
        >
          <div className="hotel-form-grid">
            <label>
              Arrival
              <input
                required
                id="booking-checkIn"
                type="date"
                name="checkIn"
                min={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Departure
              <input
                required
                id="booking-checkOut"
                type="date"
                name="checkOut"
              />
            </label>
            <label>
              Adults
              <select id="booking-adults" name="adults" defaultValue="2">
                {Array.from({ length: 8 }, (_, i) => (
                  <option key={i}>{i + 1}</option>
                ))}
              </select>
            </label>
            <label>
              Children
              <select id="booking-children" name="children">
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label>
              Rooms
              <select id="booking-rooms" name="rooms">
                {[1, 2, 3, 4].map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <label>
              Accommodation
              <select
                id="booking-roomSlug"
                name="roomSlug"
                defaultValue={params.get("room") || hotel.rooms[0].slug}
              >
                {hotel.rooms.map((r) => (
                  <option value={r.slug} key={r.slug}>
                    {r.name} · {money(r.rate)}/night
                  </option>
                ))}
              </select>
            </label>
            <label className="hotel-form-wide">
              Sample offer
              <select
                id="booking-offer"
                name="offer"
                defaultValue={params.get("offer") || ""}
              >
                <option value="">Standard sample rate</option>
                {hotel.offers.map((o, i) => (
                  <option value={i} key={o.title}>
                    {o.title} · {o.minimumNights}+ nights
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="hotel-button" disabled={pending}>
            {pending ? "Checking…" : "Check demo availability"} <span>↗</span>
          </button>
        </form>
        {error && (
          <p className="hotel-form-error" role="alert">
            {error}
          </p>
        )}
        {quote && (
          <div className="hotel-quote" aria-live="polite">
            <h3>{quote.room.name}</h3>
            <p>
              {quote.request.checkIn} → {quote.request.checkOut}
              <br />
              {quote.request.adults} adults · {quote.request.children} children
              · {quote.request.rooms} room(s)
            </p>
            <dl>
              <div>
                <dt>
                  {quote.nights} nights × {quote.request.rooms} rooms ×{" "}
                  {money(quote.room.rate)}
                </dt>
                <dd>{money(quote.subtotal)}</dd>
              </div>
              {quote.discount > 0 && (
                <div>
                  <dt>Sample offer</dt>
                  <dd>−{money(quote.discount)}</dd>
                </div>
              )}
              <div>
                <dt>Sample tax</dt>
                <dd>{money(quote.tax)}</dd>
              </div>
              <div>
                <dt>Total demo stay</dt>
                <dd>{money(quote.total)}</dd>
              </div>
            </dl>
            <p>
              {quote.available} rooms in this deterministic sample inventory.
              Nothing is held.
            </p>
            {confirmation ? (
              <p role="status">
                <strong>Demo confirmation: {confirmation}</strong>
                <br />
                No real booking or payment has been created.
              </p>
            ) : (
              <button
                className="hotel-button"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  try {
                    const result = await demoBookingProvider.confirm(
                      hotel,
                      quote.request,
                    );
                    setConfirmation(result.reference);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Confirm demo stay ↗
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
