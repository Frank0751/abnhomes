import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { LiveHomes } from "@/components/site/live-homes";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Our Homes - Serviced Apartments at Tantra Hill, Accra",
  description:
    "The homes at ABN Apartments, 8 Asiko Street, Tantra Hill: a two-bedroom penthouse, one-bedroom apartments and a studio. Live prices, book direct in under a minute.",
};

export const dynamic = "force-dynamic";

export default function ResidencesPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f5]">
      <PageHero
        title="One building. Three ways to stay."
        subtitle="The two-bedroom penthouse, the one-bedroom apartments and the studio are all at ABN Apartments, 8 Asiko Street, Tantra Hill. Prices below are live: what you see is what you pay."
        bgImage="/images/penthouse/penthouse-living-and-kitchen.jpg"
        breadcrumb="Residences"
      />

      <LiveHomes />

      {/* CTA */}
      <section className="py-20 bg-[#0c1a16] text-white text-center">
        <div className="max-w-3xl mx-auto px-5 lg:px-10">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Planning a trip to Accra?</h2>
          <p className="text-white/65 mb-8 max-w-xl mx-auto">
            Call {COMPANY.phone} to book your stay. Locate us on 8 Asiko Street on Bolt or Google Maps, or book online in under a minute.
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
