import type { Metadata } from "next";
import type { School } from "@/data/education";
import { siteOrigin } from "@/lib/hotels/seo";
export function schoolMetadata(s: School, parts: string[]): Metadata {
  const program = s.programs.find((p) => p.slug === parts[1]);
  const label =
    program?.name || (parts[0] ? parts[0].replaceAll("-", " ") : s.level);
  const title = `${label} — ${s.name} | School Website Demo`;
  const description =
    program?.description ||
    `${s.description} Explore ${label.toLowerCase()} in this fictional school website demonstration.`;
  const origin = siteOrigin(),
    path = `/education-schools/${s.slug}${parts.length ? "/" + parts.join("/") : ""}`,
    image = `/assets/education-schools/previews/${s.slug}-social.webp`;
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
      index: process.env.NEXT_PUBLIC_INDEX_SCHOOL_DEMOS === "true",
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
              alt: `${s.name} school website preview`,
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
