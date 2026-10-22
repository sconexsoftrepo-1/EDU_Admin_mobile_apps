import type { Metadata } from "next";
import type { Hotel } from "@/data/hotels-resorts";
export function siteOrigin() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (["localhost", "127.0.0.1"].includes(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
export function hotelMetadata(hotel: Hotel, parts: string[]): Metadata {
  const page = parts.join("/"),
    room = hotel.rooms.find((r) => r.slug === parts[1]),
    experience = hotel.experiences.find((e) => e.slug === parts[1]);
  const label =
    room?.name ||
    experience?.name ||
    (parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : hotel.short);
  const title = `${label} — ${hotel.name} | Hospitality Demo`;
  const description =
    room?.description ||
    experience?.description ||
    `${hotel.description} Explore the ${label.toLowerCase()} experience in this fictional hotel website template.`;
  const origin = siteOrigin(),
    path = `/hotels-resorts/${hotel.slug}${page ? `/${page}` : ""}`,
    image = `/assets/hotels-resorts/previews/${hotel.slug}-social.webp`;
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: `${origin}${path}` },
        }
      : {}),
    robots: {
      index: process.env.NEXT_PUBLIC_INDEX_HOTEL_DEMOS === "true",
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: origin
        ? [
            {
              url: origin + image,
              width: 1200,
              height: 630,
              alt: `${hotel.name} website demo`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: origin ? [origin + image] : [],
    },
  };
}
