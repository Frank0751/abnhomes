import type { MetadataRoute } from "next";

/**
 * What crawlers may fetch.
 *
 * Every page here is rendered on demand, so every crawler request is a paid
 * function call. In November 2026 ClaudeBot alone made ~42,000 calls in two
 * days, almost all to /book with different dates and filters in the query
 * string: each combination is a "new page" to a crawler, and there are
 * endless combinations. Those variants are now off limits. /book itself,
 * every /stays/ room page and the rest of the public site stay crawlable,
 * so search and AI-assistant visibility is unaffected.
 *
 * "/book?" matches /book followed by any query string, and nothing else.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/book?",
        "/admin",
        "/portal",
        "/signin",
        "/set-password/",
        "/pay",
        "/payments/",
        "/receipt/",
        "/track/",
      ],
    },
    sitemap: "https://abnhomesltd.com/sitemap.xml",
    host: "https://abnhomesltd.com",
  };
}
