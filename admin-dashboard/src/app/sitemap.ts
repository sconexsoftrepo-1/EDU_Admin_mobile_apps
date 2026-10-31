import { restaurants, restaurantRoutes } from "@/data/restaurants";
import type { MetadataRoute } from "next";
import { schools, schoolRoutes } from "@/data/education";
import { hotels, hotelRoutes } from "@/data/hotels-resorts";
import { siteOrigin } from "@/lib/hotels/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  const publicPaths = [
    "/",
    "/templates",
    "/hotels-resorts",
    "/education-schools",
    "/restaurants-food",
    "/contact",
  ];
  const demoPaths =
    process.env.NEXT_PUBLIC_INDEX_HOTEL_DEMOS === "true"
      ? hotels.flatMap((h) => [
          ...hotelRoutes.map(
            (p) => `/hotels-resorts/${h.slug}${p ? "/" + p : ""}`,
          ),
          ...h.rooms.map((r) => `/hotels-resorts/${h.slug}/rooms/${r.slug}`),
          ...h.experiences.map(
            (e) => `/hotels-resorts/${h.slug}/experiences/${e.slug}`,
          ),
        ])
      : [];
  const schoolPaths =
    process.env.NEXT_PUBLIC_INDEX_SCHOOL_DEMOS === "true"
      ? schools.flatMap((s) => [
          ...schoolRoutes.map(
            (p) => `/education-schools/${s.slug}${p ? "/" + p : ""}`,
          ),
          ...s.programs.map(
            (p) => `/education-schools/${s.slug}/academics/${p.slug}`,
          ),
        ])
      : [];
  const restaurantPaths =
    process.env.NEXT_PUBLIC_INDEX_RESTAURANT_DEMOS === "true"
      ? restaurants.flatMap((r) => [
          ...restaurantRoutes
            .filter(
              (p) =>
                ![
                  "cart",
                  "checkout",
                  "qr",
                  "order",
                  "order-confirmation",
                  "demo-kitchen",
                ].includes(p),
            )
            .map((p) => `/restaurants-food/${r.slug}${p ? "/" + p : ""}`),
          ...r.menu.map((d) => `/restaurants-food/${r.slug}/menu/${d.slug}`),
        ])
      : [];
  return [...publicPaths, ...demoPaths, ...schoolPaths, ...restaurantPaths].map(
    (p) => ({
      url: origin + p,
      changeFrequency: "monthly",
      priority: p === "/" ? 1 : 0.7,
    }),
  );
}
