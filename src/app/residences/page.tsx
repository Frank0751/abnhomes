import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Properties } from "@/components/site/properties";
import { FeaturedSpotlight } from "@/components/site/featured-spotlight";
import { Calculator } from "@/components/site/calculator-section";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Residences - Luxury Apartments in Accra",
  description:
    "Explore ABN Homes residences across Accra: 2 bedroom penthouse at Tantra Hill with 75-inch Smart TVs and rooftop bar, 4 bedroom ensuite at Achimota Petroleum Estate, and furnished 1 bedroom apartments. From USD $50 per night.",
};

export default function ResidencesPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        eyebrow="Our Residences"
        title="Three addresses. One uncompromising standard."
        subtitle="From the 2 bedroom penthouse at Tantra Hill with 75-inch Smart TVs and open rooftop bar, to the 4 bedroom ensuite at Achimota Petroleum Estate, every ABN residence is crafted for those who expect more from where they stay in Accra."
        bgImage="/images/abn-real/abn-ig-2-hd.jpg"
        breadcrumb="Residences"
      />

      <Properties />
      <FeaturedSpotlight />
      <Calculator />

      {/* CTA */}
      <section className="py-20 bg-[#0a0e1a] text-white text-center">
        <div className="max-w-3xl mx-auto px-5 lg:px-10">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Planning a trip to Accra?</h2>
          <p className="text-white/65 mb-8 max-w-xl mx-auto">
            Call {COMPANY.phone} to book your stay. Locate us on 8 Asiko Street on Bolt or Google Maps. Short and long stay options available.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center px-8 py-4 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Book Your Stay
          </a>
        </div>
      </section>
    </main>
  );
}
