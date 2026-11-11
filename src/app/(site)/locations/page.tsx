import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Locations } from "@/components/site/locations";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Locations - Where We Build in Accra",
  description:
    "ABN Homes operates across Accra, Ghana. Visit us at 8 Asiko Street, Tantra Hill, or explore our Achimota Petroleum Estate residence. Available across Greater Accra for short and long stays.",
};

export default function LocationsPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        title="Three Accra neighbourhoods, one address you will love."
        subtitle="From Tantra Hill to Achimota Petroleum Estate and across Greater Accra, ABN Homes operates where Accra lives, works and grows. Locate us on 8 Asiko Street on Bolt or Google Maps."
        bgImage="/images/abn-real/abn-ig-3-hd.jpg"
        breadcrumb="Locations"
      />

      <Locations />

      {/* Visit us section */}
      <section className="py-20 bg-[#0a0e1a] text-white">
        <div className="max-w-3xl mx-auto px-5 lg:px-10 text-center">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Come and see for yourself.</h2>
          <p className="text-white/65 mb-8 max-w-xl mx-auto">
            Visit our head office at {COMPANY.address}. Open {COMPANY.hours}. Call {COMPANY.phone} to schedule a tour.
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=ABN+Apartments+Tantra+Hill+Accra`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-4 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Open in Google Maps
          </a>
        </div>
      </section>
    </main>
  );
}
