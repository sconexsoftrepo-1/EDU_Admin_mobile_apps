import { notFound } from "next/navigation";
import {
  hotels,
  hotelBySlug,
  hotelRoutes,
  validHotelPath,
} from "@/data/hotels-resorts";
import { hotelMetadata } from "@/lib/hotels/seo";
import HotelChrome from "@/components/hotels/HotelChrome";
import HotelPage from "@/components/hotels/HotelPage";
import {
  ResortHome,
  LuxuryHome,
  MountainHome,
  BeachHome,
} from "@/components/hotels/HotelHomes";
type Props = { params: Promise<{ templateSlug: string; slug?: string[] }> };
export function generateStaticParams() {
  return hotels.flatMap((h) => [
    ...hotelRoutes.map((r) => ({ templateSlug: h.slug, slug: r ? [r] : [] })),
    ...h.rooms.map((r) => ({ templateSlug: h.slug, slug: ["rooms", r.slug] })),
    ...h.experiences.map((e) => ({
      templateSlug: h.slug,
      slug: ["experiences", e.slug],
    })),
  ]);
}
export async function generateMetadata({ params }: Props) {
  const { templateSlug, slug = [] } = await params;
  const h = hotelBySlug(templateSlug);
  if (!h || !validHotelPath(h, slug)) return {};
  return hotelMetadata(h, slug);
}
export default async function Page({ params }: Props) {
  const { templateSlug, slug = [] } = await params;
  const h = hotelBySlug(templateSlug);
  if (!h || !validHotelPath(h, slug)) notFound();
  const Home = {
    "resort-paradise": ResortHome,
    "luxury-hotel": LuxuryHome,
    "mountain-retreat": MountainHome,
    "beach-resort": BeachHome,
  }[h.slug];
  return (
    <HotelChrome hotel={h}>
      {slug.length ? <HotelPage hotel={h} parts={slug} /> : <Home hotel={h} />}
    </HotelChrome>
  );
}
