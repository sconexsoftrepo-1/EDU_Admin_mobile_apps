import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/hotels/seo";
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/colleges-institutions/*/portal",
        "/colleges-institutions/*/verify-certificate",
        "/colleges-institutions/*/admissions/apply",
      ],
    },
    ...(origin ? { sitemap: `${origin}/sitemap.xml` } : {}),
  };
}
