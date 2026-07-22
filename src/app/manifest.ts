import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABN Homes Company Limited",
    short_name: "ABN Homes",
    description:
      "Luxury apartments and homes across Accra, Ghana. Tantra Hill, Sakumono and Nii Ayi Mensah residences by ABN Homes Company Limited.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#0a0e1a",
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
