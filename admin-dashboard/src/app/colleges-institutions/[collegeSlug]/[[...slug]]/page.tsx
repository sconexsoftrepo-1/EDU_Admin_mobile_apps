import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  collegeBySlug,
  colleges,
  collegeRoot,
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
  const origin = siteOrigin();
  const url =
    collegeRoot(c) + (slug.length ? "/" + slug.join("/") : "/portal/login");
  return {
    title: `${slug.at(-1)?.replaceAll("-", " ") || "Login"} | ${c.name}`,
    description: `Sign in to ${c.name} campus management.`,
    robots: { index: false, follow: false },
    metadataBase: origin ? new URL(origin) : undefined,
    alternates: origin ? { canonical: origin + url } : undefined,
  };
}
export default async function Page({ params }: Props) {
  const { collegeSlug, slug = [] } = await params,
    c = collegeBySlug(collegeSlug);
  if (!c) notFound();
  if (!slug.length || !["portal", "verify-certificate"].includes(slug[0]))
    redirect(`${collegeRoot(c)}/portal/login`);
  if (!validCollegePath(c, slug)) notFound();
  return <CollegePage college={c} parts={slug} />;
}
