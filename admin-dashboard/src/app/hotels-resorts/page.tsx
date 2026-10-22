import type { Metadata } from "next";
import HotelCategory from "@/components/hotels/HotelCategory";
import { hotels } from "@/data/hotels-resorts";
import { siteOrigin } from "@/lib/hotels/seo";
const title = "Hotels & Resorts — Four Interactive Templates | KC Web Universe";
const description =
  "Explore four distinct hospitality website templates: a sunset resort, a luxury city hotel, an alpine retreat and overwater villas. Interactive 3D property guides and demo booking.";
export function generateMetadata(): Metadata {
  const origin = siteOrigin();
  const image = "/assets/hotels-resorts/previews/category-social.webp";
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: origin + "/hotels-resorts" },
        }
      : {}),
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
export default function Page() {
  const origin = siteOrigin();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Hotels & Resorts website templates",
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: 4,
      itemListElement: hotels.map((h, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: h.name,
          description: `Fictional ${h.short.toLowerCase()} website template. ${h.description}`,
          ...(origin ? { url: `${origin}/hotels-resorts/${h.slug}` } : {}),
        },
      })),
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
      <HotelCategory />
    </>
  );
}
