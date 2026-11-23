import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { unitSlug } from "@/lib/marketplace/units";

const BASE = "https://abnhomes.com.gh";

/**
 * Rendered per request, from the live database.
 *
 * It used to be rendered once at build time, which had two costs. A newly
 * published room did not reach search engines until the next deploy. And the
 * build needed working database credentials just for this one read — on
 * Cloudflare that would mean storing the connection string in the build
 * settings as well as the runtime ones. Crawlers fetch a sitemap a few times
 * a day; one query each time is nothing.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/book`, lastModified: new Date(), changeFrequency: "daily", priority: 0.95 },
    { url: `${BASE}/residences`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/amenities`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/gallery`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/locations`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
  ];

  // Live listing pages: every published home is a landing page for search.
  try {
    const properties = await db.property.findMany({
      where: { published: true, active: true },
      select: {
        slug: true,
        units: {
          where: { published: true, lettingMode: { in: ["SHORT_STAY", "BOTH"] } },
          select: { code: true, slug: true, updatedAt: true },
        },
      },
    });

    const listingRoutes: MetadataRoute.Sitemap = properties.flatMap((p) =>
      p.units.map((u) => ({
        url: `${BASE}/stays/${unitSlug(u, p)}`,
        lastModified: u.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      }))
    );

    return [...staticRoutes, ...listingRoutes];
  } catch {
    // A database hiccup must never break the sitemap — static routes alone
    // are still a valid sitemap.
    return staticRoutes;
  }
}
