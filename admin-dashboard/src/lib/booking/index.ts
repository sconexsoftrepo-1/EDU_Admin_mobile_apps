import type { Hotel, HotelRoom } from "@/data/hotels-resorts";
export type BookingRequest = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  roomSlug: string;
  offer?: number;
};
export type BookingQuote = {
  request: BookingRequest;
  room: HotelRoom;
  nights: number;
  available: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};
export class BookingError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}
const day = 86400000;
function date(value: string, field: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new BookingError(field, "Choose a valid date.");
  return time;
}
export function quoteBooking(
  hotel: Hotel,
  request: BookingRequest,
  today = new Date(),
): BookingQuote {
  const arrival = date(request.checkIn, "checkIn"),
    departure = date(request.checkOut, "checkOut");
  const now = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  if (arrival < now)
    throw new BookingError(
      "checkIn",
      "Arrival must be today or a future date.",
    );
  const nights = (departure - arrival) / day;
  if (nights < 1 || nights > 30)
    throw new BookingError(
      "checkOut",
      "Choose a departure 1–30 nights after arrival.",
    );
  for (const [key, min, max] of [
    ["adults", 1, 8],
    ["children", 0, 8],
    ["rooms", 1, 4],
  ] as const)
    if (
      !Number.isInteger(request[key]) ||
      request[key] < min ||
      request[key] > max
    )
      throw new BookingError(key, `Choose ${min}–${max} ${key}.`);
  const room = hotel.rooms.find((r) => r.slug === request.roomSlug);
  if (!room) throw new BookingError("roomSlug", "Choose an accommodation.");
  if (request.adults + request.children > room.capacity * request.rooms)
    throw new BookingError(
      "rooms",
      `This accommodation hosts ${room.capacity} guests per room. Add rooms or choose another stay.`,
    );
  const available = 4 - ((arrival / day + hotel.rooms.indexOf(room)) % 3);
  if (request.rooms > available)
    throw new BookingError(
      "rooms",
      `Only ${available} rooms in this sample inventory. Reduce rooms or try another date.`,
    );
  const subtotal = room.rate * nights * request.rooms,
    offer =
      request.offer === undefined ? undefined : hotel.offers[request.offer];
  if (request.offer !== undefined && !offer)
    throw new BookingError("offer", "Choose a valid sample offer.");
  if (offer && nights < offer.minimumNights)
    throw new BookingError(
      "checkOut",
      `This offer needs at least ${offer.minimumNights} nights.`,
    );
  const round = (n: number) => Math.round(n * 100) / 100,
    discount = round(subtotal * (offer?.discount || 0)),
    tax = round((subtotal - discount) * hotel.taxRate);
  return {
    request,
    room,
    nights,
    available,
    subtotal,
    discount,
    tax,
    total: round(subtotal - discount + tax),
  };
}
export interface BookingProvider {
  quote(hotel: Hotel, request: BookingRequest): Promise<BookingQuote>;
  confirm(
    hotel: Hotel,
    request: BookingRequest,
  ): Promise<{ reference: string; quote: BookingQuote; demo: true }>;
}
export const demoBookingProvider: BookingProvider = {
  async quote(h, r) {
    return quoteBooking(h, r);
  },
  async confirm(h, r) {
    const quote = quoteBooking(h, r);
    return {
      reference: `DEMO-${h.monogram}-${r.checkIn.replaceAll("-", "")}-${h.rooms.indexOf(quote.room) + 1}`,
      quote,
      demo: true,
    };
  },
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
