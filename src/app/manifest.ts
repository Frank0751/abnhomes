import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABN Homes Company Limited",
    short_name: "ABN Homes",
    description:
      "Serviced apartments at 8 Asiko Street, Tantra Hill, Accra, by ABN Homes Company Limited.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#0c1a16",
    orientation: "portrait-primary",
    categories: ["business", "lifestyle", "shopping"],
    icons: [
      {
        src: "/images/logo/abn-badge.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/logo/abn-badge.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "View Residences",
        url: "/#residences",
        description: "Browse ABN Homes residences",
      },
      {
        name: "Book a Tour",
        url: "/#contact",
        description: "Schedule a visit to an ABN property",
      },
    ],
  };
}
