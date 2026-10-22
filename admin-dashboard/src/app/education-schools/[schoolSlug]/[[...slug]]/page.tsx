import { notFound } from "next/navigation";
import {
  schools,
  schoolBySlug,
  schoolRoutes,
  validSchoolPath,
} from "@/data/education";
import { schoolMetadata } from "@/lib/education/seo";
import SchoolChrome from "@/components/education/SchoolChrome";
import SchoolPage from "@/components/education/SchoolPage";
import {
  LittleSproutsHome,
  SunriseHome,
  MaplewoodHome,
  EvergreenHome,
} from "@/components/education/SchoolHomes";
import { siteOrigin } from "@/lib/hotels/seo";
type Props = { params: Promise<{ schoolSlug: string; slug?: string[] }> };
export function generateStaticParams() {
  return schools.flatMap((s) => [
    ...schoolRoutes.map((p) => ({ schoolSlug: s.slug, slug: p ? [p] : [] })),
    ...s.programs.map((p) => ({
      schoolSlug: s.slug,
      slug: ["academics", p.slug],
    })),
  ]);
}
export async function generateMetadata({ params }: Props) {
  const { schoolSlug, slug = [] } = await params;
  const s = schoolBySlug(schoolSlug);
  return s && validSchoolPath(s, slug) ? schoolMetadata(s, slug) : {};
}
export default async function Page({ params }: Props) {
  const { schoolSlug, slug = [] } = await params;
  const s = schoolBySlug(schoolSlug);
  if (!s || !validSchoolPath(s, slug)) notFound();
  const Home = {
    "little-sprouts": LittleSproutsHome,
    "sunrise-international": SunriseHome,
    "maplewood-high": MaplewoodHome,
    "evergreen-global": EvergreenHome,
  }[s.slug];
  const origin = siteOrigin();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: `${s.name} — ${slug.join(" / ") || "School website demo"}`,
    description: `Fictional ${s.level.toLowerCase()} template. ${s.description}`,
    isAccessibleForFree: true,
    ...(origin
      ? {
          url: `${origin}/education-schools/${s.slug}${slug.length ? "/" + slug.join("/") : ""}`,
        }
      : {}),
  };
  return (
    <SchoolChrome key={s.slug} school={s}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replaceAll("<", "\\u003c"),
        }}
      />
      {slug.length ? (
        <SchoolPage school={s} parts={slug} />
      ) : (
        <Home school={s} />
      )}
    </SchoolChrome>
  );
}
