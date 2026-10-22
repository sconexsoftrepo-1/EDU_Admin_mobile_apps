import type { Metadata } from "next";
import EducationCategory from "@/components/education/EducationCategory";
import { schools } from "@/data/education";
import { siteOrigin } from "@/lib/hotels/seo";
const title =
  "Education & Schools — Four Interactive Templates | KC Web Universe";
const description =
  "Four stages of learning. Four unique digital experiences. Explore complete preschool, primary, high school and senior school website templates with interactive 3D campus guides.";
export function generateMetadata(): Metadata {
  const origin = siteOrigin(),
    image = "/assets/education-schools/previews/category-social.webp";
  return {
    title,
    description,
    ...(origin
      ? {
          metadataBase: new URL(origin),
          alternates: { canonical: origin + "/education-schools" },
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
    name: "Education & Schools website templates",
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: 4,
      itemListElement: schools.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "CreativeWork",
          name: s.name,
          description: `Fictional ${s.level.toLowerCase()} website template.`,
          ...(origin ? { url: `${origin}/education-schools/${s.slug}` } : {}),
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
      <EducationCategory />
    </>
  );
}
