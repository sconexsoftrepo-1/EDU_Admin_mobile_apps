import { notFound } from "next/navigation";
import {
  restaurants,
  restaurantBySlug,
  restaurantRoutes,
  validRestaurantPath,
} from "@/data/restaurants";
import RestaurantPage from "@/components/restaurants/RestaurantPage";
import { restaurantMetadata } from "@/lib/restaurants/seo";
import { siteOrigin } from "@/lib/hotels/seo";
type Props = { params: Promise<{ restaurantSlug: string; slug?: string[] }> };
export function generateStaticParams() {
  return restaurants.flatMap((r) => [
    ...restaurantRoutes.map((p) => ({
      restaurantSlug: r.slug,
      slug: p ? [p] : [],
    })),
    ...r.menu.map((d) => ({ restaurantSlug: r.slug, slug: ["menu", d.slug] })),
    ...r.tables
      .filter((t) => t.active)
      .map((t) => ({ restaurantSlug: r.slug, slug: ["qr", t.token] })),
  ]);
}
export async function generateMetadata({ params }: Props) {
  const { restaurantSlug, slug = [] } = await params,
    r = restaurantBySlug(restaurantSlug);
  if (!r || !validRestaurantPath(r, slug)) return {};
  return restaurantMetadata(r, slug);
}
export default async function Page({ params }: Props) {
  const { restaurantSlug, slug = [] } = await params,
    r = restaurantBySlug(restaurantSlug);
  if (!r || !validRestaurantPath(r, slug)) notFound();
  const origin = siteOrigin(),
    schema = {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: `${r.name} — fictional restaurant website demo`,
      description: r.description,
      ...(origin ? { url: origin + `/restaurants-food/${r.slug}` } : {}),
    };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
      <RestaurantPage restaurant={r} parts={slug} />
    </>
  );
}
