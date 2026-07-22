import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Amenities } from "@/components/site/amenities";
import { ServicesList } from "@/components/site/services-list";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Amenities & Services",
  description:
    "Every ABN residence comes with 75-inch Smart TVs, air conditioning, free WiFi, private parking, backup power, 24/7 security and more. Plus full construction, land sales and renovation services across Accra.",
};

export default function AmenitiesPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        eyebrow="Amenities & Services"
        title="Considered details, included as standard."
        subtitle="From 75-inch Smart TVs and open rooftop bars to full construction and renovation services, ABN Homes delivers everything you need to live, build or invest in Accra."
        bgImage="/images/abn-real/abn-ig-1-hd.jpg"
        breadcrumb="Amenities"
      />

      <Amenities />
      <ServicesList />
    </main>
  );
}
