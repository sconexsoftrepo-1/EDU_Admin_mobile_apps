import type { Metadata } from "next";
import type { Restaurant } from "@/data/restaurants";
import { siteOrigin } from "@/lib/hotels/seo";
export function restaurantMetadata(r: Restaurant, parts: string[]): Metadata {
  const dish =
      parts[0] === "menu" ? r.menu.find((d) => d.slug === parts[1]) : undefined,
    label = dish?.name || parts[0]?.replaceAll("-", " ") || r.kind,
    title = `${label} — ${r.name} | Restaurant Website Demo`,
    description =
      dish?.description ||
      `${r.description} Explore ${label.toLowerCase()} in this fictional restaurant website demonstration.`,
    origin = siteOrigin(),
    path = `/restaurants-food/${r.slug}${parts.length ? "/" + parts.join("/") : ""}`,
    image = `/assets/restaurants-food/previews/${r.slug}-social.webp`,
    transactional = [
      "cart",
      "checkout",
      "qr",
      "order-confirmation",
      "demo-kitchen",
      "order",
    ].includes(parts[0]);
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: origin + path },
        }
      : {}),
    robots: {
      index:
        !transactional &&
        process.env.NEXT_PUBLIC_INDEX_RESTAURANT_DEMOS === "true",
      follow: !transactional,
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: origin ? [{ url: origin + image, width: 1200, height: 630 }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: origin ? [origin + image] : [],
    },
  };
}
