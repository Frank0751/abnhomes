import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Locations } from "@/components/site/locations";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "Location - 8 Asiko Street, Tantra Hill, Accra",
  description:
    "ABN Apartments is at 8 Asiko Street, Tantra Hill, Accra, about 27 minutes from Osu by car. Find us on Google Maps or Bolt.",
};

export default function LocationsPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f5]">
      <PageHero
        title="One address: 8 Asiko Street, Tantra Hill."
        subtitle="Every ABN apartment is in one building in Tantra Hill, about 27 minutes from Osu by car. Search for ABN Apartments on Bolt or Google Maps."
        bgImage="/images/abn-real/abn-ig-3-hd.jpg"
        breadcrumb="Locations"
      />

      <Locations />

      {/* Visit us section */}
      <section className="py-20 bg-[#0c1a16] text-white">
        <div className="max-w-3xl mx-auto px-5 lg:px-10 text-center">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">Come and see for yourself.</h2>
          <p className="text-white/65 mb-8 max-w-xl mx-auto">
            Visit our head office at {COMPANY.address}. Open {COMPANY.hours}. Call {COMPANY.phone} to schedule a tour.
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=ABN+Apartments+Tantra+Hill+Accra`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-8 py-4 bg-[#00a878] hover:bg-[#1fd39a] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Open in Google Maps
          </a>
        </div>
      </section>
    </main>
  );
}
