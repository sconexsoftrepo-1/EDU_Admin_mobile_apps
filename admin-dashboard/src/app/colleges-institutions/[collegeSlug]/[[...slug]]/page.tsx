import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  collegeBySlug,
  colleges,
  collegeRoot,
  publicRoutes,
  modules,
  roleHome,
  validCollegePath,
} from "@/data/colleges";
import CollegePage from "@/components/colleges/CollegePage";
import { siteOrigin } from "@/lib/hotels/seo";
type Props = {
  params: Promise<{
    collegeSlug: string;
    slug?: string[];
  }>;
};
export function generateStaticParams() {
  return colleges.flatMap((c) =>
    [
      ...publicRoutes,
      ...c.programs.map((p) => "academics/" + p.slug),
      "portal/login",
      ...Array.from(new Set(Object.values(roleHome))).flatMap((a) => [
        `portal/${a}`,
        ...modules.map((m) => `portal/${a}/${m}`),
      ]),
    ].map((p) => ({ collegeSlug: c.slug, slug: p ? p.split("/") : [] })),
  );
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collegeSlug, slug = [] } = await params,
    c = collegeBySlug(collegeSlug);
  if (!c) return {};
  const origin = siteOrigin(),
    privatePage =
      ["portal", "verify-certificate"].includes(slug[0]) ||
      slug.join("/") === "admissions/apply",
    url = collegeRoot(c) + (slug.length ? "/" + slug.join("/") : "");
  return {
    title: `${slug.length ? slug.at(-1)!.replaceAll("-", " ") + " | " : ""}${c.name} — College Demo`,
    description:
      c.description +
      " Fictional institution and interactive campus management demonstration.",
    robots: {
      index:
        !privatePage && process.env.NEXT_PUBLIC_INDEX_COLLEGE_DEMOS === "true",
      follow: !privatePage,
    },
    metadataBase: origin ? new URL(origin) : undefined,
    alternates: origin ? { canonical: origin + url } : undefined,
    openGraph: {
      title: c.name,
      description: c.description,
      images: origin
        ? [`${origin}/assets/colleges-institutions/${c.slug}/campus.webp`]
        : undefined,
    },
  };
}
export default async function Page({ params }: Props) {
  const { collegeSlug, slug = [] } = await params,
    c = collegeBySlug(collegeSlug);
  if (!c || !validCollegePath(c, slug)) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: c.name + " — fictional college template",
            description: c.description,
          }).replaceAll("<", "\\u003c"),
        }}
      />
      <CollegePage college={c} parts={slug} />
    </>
  );
}
