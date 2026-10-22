import type { Metadata } from "next";
import RestaurantCategory from "@/components/restaurants/RestaurantCategory";
import { restaurants } from "@/data/restaurants";
import { siteOrigin } from "@/lib/hotels/seo";
const title =
    "Restaurants & Food — Six Interactive Templates | KC Web Universe",
  description =
    "Six flavors. Six digital experiences. Explore cinematic restaurant websites with 3D food stories, smart QR menus and local demo ordering.";
export function generateMetadata(): Metadata {
  const origin = siteOrigin(),
    image = "/assets/restaurants-food/previews/category-social.webp";
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: origin + "/restaurants-food" },
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
    name: title,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: 6,
      itemListElement: restaurants.map((r, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: r.name,
          description: "Fictional restaurant website demo",
          ...(origin ? { url: origin + "/restaurants-food/" + r.slug } : {}),
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
      <RestaurantCategory />
    </>
  );
}
