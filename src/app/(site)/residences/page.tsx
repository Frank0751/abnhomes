import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Properties } from "@/components/site/properties";
import { FeaturedSpotlight } from "@/components/site/featured-spotlight";
import { Calculator } from "@/components/site/calculator-section";
import { LiveHomes } from "@/components/site/live-homes";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Residences - Luxury Apartments in Accra",
  description:
    "Explore ABN Homes residences across Accra: 2 bedroom penthouse at Tantra Hill with 75-inch Smart TVs and rooftop bar, 4 bedroom ensuite at Achimota Petroleum Estate, and furnished 1 bedroom apartments. From USD $50 per night.",
};

export const dynamic = "force-dynamic";

export default function ResidencesPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f5]">
      <PageHero
        title="Three addresses. One uncompromising standard."
        subtitle="From the 2 bedroom penthouse at Tantra Hill with 75-inch Smart TVs and open rooftop bar, to the 4 bedroom ensuite at Achimota Petroleum Estate, every ABN residence is crafted for those who expect more from where they stay in Accra."
        bgImage="/images/properties/tantra4-atrium.jpg"
        breadcrumb="Residences"
      />

      <LiveHomes />
      <Properties />
      <FeaturedSpotlight />
      <Calculator />

      {/* CTA */}
      <section className="py-20 bg-[#0c1a16] text-white text-center">
        <div className="max-w-3xl mx-auto px-5 lg:px-10">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Planning a trip to Accra?</h2>
          <p className="text-white/65 mb-8 max-w-xl mx-auto">
            Call {COMPANY.phone} to book your stay. Locate us on 8 Asiko Street on Bolt or Google Maps. Short and long stay options available.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center px-8 py-4 bg-[#00a878] hover:bg-[#1fd39a] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Book Your Stay
          </a>
        </div>
      </section>
    </main>
  );
}
