import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: "https://abnhomes.com.gh/sitemap.xml",
    host: "https://abnhomes.com.gh",
  };
}
