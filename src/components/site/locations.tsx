"use client";

import { motion } from "framer-motion";
import { MapPin, Plane, Building, Landmark } from "lucide-react";

type Location = {
  name: string;
  area: string;
  image: string;
  description: string;
  highlights: { icon: React.ElementType; label: string }[];
  distance: string;
};

const locations: Location[] = [
  {
    name: "Tantra Hill",
    area: "Greater Accra",
    image: "/images/building/abn-apartments-tantra-hill.jpg",
    description:
      "ABN Apartments is at 8 Asiko Street, Tantra Hill: the penthouse, the one-bedroom apartments and the studio are all in this one building. Search for ABN Apartments on Google Maps or Bolt and it brings you to the gate.",
    highlights: [
      { icon: MapPin, label: "8 Asiko Street, Tantra Hill, Accra" },
      { icon: Building, label: "About 27 minutes from Osu by car" },
      { icon: Landmark, label: "On Google Maps and Bolt as ABN Apartments" },
    ],
    distance: "About 27 minutes from Osu",
  },
];

export function Locations() {
  return (
    <section id="locations" className="relative py-24 lg:py-32 bg-[#f5f7f5] overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#00a878]/5 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0c1a16] leading-[1.05] tracking-[-0.02em] mb-6">
              Find us in Tantra Hill.
            </h2>
            <p className="text-[#2d433b] text-base md:text-lg leading-relaxed">
              ABN Apartments is one building at 8 Asiko Street. Open it in
              Google Maps for directions from wherever you are.
            </p>
            <a
              href="https://maps.app.goo.gl/SmhD4Tbw8niTKvJT7"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 bg-[#0c1a16] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#00a878]"
            >
              <MapPin className="size-4" />
              Open in Google Maps
            </a>
          </motion.div>
        </div>

        {/* Locations grid */}
        <div className="mx-auto grid max-w-xl gap-6 lg:gap-8">
          {locations.map((location, i) => (
            <motion.div
              key={location.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className="group relative bg-white border border-[#dce5e0] overflow-hidden hover:border-[#00a878]/50 transition-colors duration-500"
            >
              {/* Image */}
              <div className="relative h-72 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[1500ms] ease-out group-hover:scale-110"
                  style={{ backgroundImage: `url(${location.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1a16]/90 via-[#0c1a16]/30 to-transparent" />
                <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/80 bg-[#0c1a16]/40 backdrop-blur-sm px-3 py-1.5">
                    {location.area}
                  </span>
                  <span className="font-serif text-2xl text-[#00a878]">
                    0{i + 1}
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <h3 className="font-serif text-3xl lg:text-4xl text-white leading-tight">
                    {location.name}
                  </h3>
                  <div className="flex items-center gap-2 text-white/70 text-xs tracking-[0.2em] uppercase mt-1">
                    <MapPin className="h-3.5 w-3.5 text-[#00a878]" />
                    {location.distance}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-7 lg:p-8">
                <p className="text-[#2d433b] leading-relaxed mb-6 text-sm">
                  {location.description}
                </p>
                <div className="space-y-2.5">
                  {location.highlights.map((h, hi) => (
                    <div key={hi} className="flex items-center gap-3 text-sm text-[#2d433b]">
                      <h.icon className="h-4 w-4 text-[#00a878] shrink-0" strokeWidth={1.5} />
                      <span>{h.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Map embed */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="mt-16 relative border border-[#dce5e0] overflow-hidden h-[420px]"
        >
          <iframe
            title="ABN Homes Accra locations"
            src="https://www.google.com/maps?q=Tantra+Hill+Accra+Ghana&output=embed"
            className="absolute inset-0 w-full h-full grayscale-[30%] contrast-105"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute top-6 left-6 max-w-xs bg-[#0c1a16] text-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-[#00a878]" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#00a878]">Head Office</span>
            </div>
            <div className="font-serif text-lg leading-snug mb-1">
              8 Asiko Street, Tantra Hill
            </div>
            <div className="text-white/65 text-sm">
              Accra, Greater Accra Region, Ghana
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=ABN+Apartments+Tantra+Hill+Accra"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-xs tracking-[0.2em] uppercase text-[#00a878] hover:text-white transition-colors"
            >
              Open in Google Maps
              <span aria-hidden>-&gt;</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
