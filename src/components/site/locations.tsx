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
    image: "/images/abn-real/abn-ig-11-hd.jpg",
    description:
      "Home to our flagship ABN Apartments at 8 Asiko Street. Tantra Hill is a rapidly growing residential enclave that blends quiet suburban calm with fast access to the airport, the city centre and the Independence Arch corridor. Locate us on Bolt or Google Maps.",
    highlights: [
      { icon: Plane, label: "7.5 mi to Kotoka Intl Airport" },
      { icon: Landmark, label: "8 mi to Kwame Nkrumah Park" },
      { icon: Building, label: "8.7 mi to Independence Arch" },
    ],
    distance: "Central Accra in 25 minutes",
  },
  {
    name: "Achimota Petroleum Estate",
    area: "Accra",
    image: "/images/abn-real/abn-ig-5-hd.jpg",
    description:
      "Our 4 bedroom ensuite residence with 2 halls and a spacious compound in a serene environment. Achimota Petroleum Estate is an established residential area popular with families seeking space, security and easy access to central Accra.",
    highlights: [
      { icon: Building, label: "4 bedrooms ensuite with 2 halls" },
      { icon: MapPin, label: "Spacious compound, serene environment" },
      { icon: Landmark, label: "Close to Achimota Mall" },
    ],
    distance: "Central Accra in 20 minutes",
  },
  {
    name: "Accra Wide",
    area: "Greater Accra Region",
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    description:
      "ABN Homes Company Limited operates across Accra, with furnished apartments and rental properties available for short and long stays. Whether you are visiting for business, a holiday, or relocating, we have a home for you. Call 054 170 4048 to book.",
    highlights: [
      { icon: Building, label: "Short and long stay options" },
      { icon: MapPin, label: "Furnished apartments available" },
      { icon: Landmark, label: "24/7 security at every property" },
    ],
    distance: "Available across Greater Accra",
  },
];

export function Locations() {
  return (
    <section id="locations" className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#0d9488]/5 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="w-10 h-px bg-[#0d9488]" />
              <span className="text-[11px] tracking-[0.4em] text-[#0d9488] font-medium uppercase">
                Where We Build
              </span>
              <span className="w-10 h-px bg-[#0d9488]" />
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em] mb-6">
              Three Accra neighbourhoods, one address you will love.
            </h2>
            <p className="text-[#3a3530] text-base md:text-lg leading-relaxed">
              We choose our locations carefully, prioritising neighbourhoods
              with strong infrastructure, growing demand and a clear sense of
              community. Each ABN address is positioned to make everyday Accra
              life easier and more rewarding.
            </p>
          </motion.div>
        </div>

        {/* Locations grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {locations.map((location, i) => (
            <motion.div
              key={location.name}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              className="group relative bg-white border border-[#e8e3d8] overflow-hidden hover:border-[#0d9488]/50 transition-colors duration-500"
            >
              {/* Image */}
              <div className="relative h-72 overflow-hidden">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[1500ms] ease-out group-hover:scale-110"
                  style={{ backgroundImage: `url(${location.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/90 via-[#0a0e1a]/30 to-transparent" />
                <div className="absolute top-5 left-5 right-5 flex items-start justify-between">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-white/80 bg-[#0a0e1a]/40 backdrop-blur-sm px-3 py-1.5">
                    {location.area}
                  </span>
                  <span className="font-serif text-2xl text-[#0d9488]">
                    0{i + 1}
                  </span>
                </div>
                <div className="absolute bottom-5 left-5 right-5">
                  <h3 className="font-serif text-3xl lg:text-4xl text-white leading-tight">
                    {location.name}
                  </h3>
                  <div className="flex items-center gap-2 text-white/70 text-xs tracking-[0.2em] uppercase mt-1">
                    <MapPin className="h-3.5 w-3.5 text-[#0d9488]" />
                    {location.distance}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-7 lg:p-8">
                <p className="text-[#3a3530] leading-relaxed mb-6 text-sm">
                  {location.description}
                </p>
                <div className="space-y-2.5">
                  {location.highlights.map((h, hi) => (
                    <div key={hi} className="flex items-center gap-3 text-sm text-[#3a3530]">
                      <h.icon className="h-4 w-4 text-[#0d9488] shrink-0" strokeWidth={1.5} />
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
          className="mt-16 relative border border-[#e8e3d8] overflow-hidden h-[420px]"
        >
          <iframe
            title="ABN Homes Accra locations"
            src="https://www.google.com/maps?q=Tantra+Hill+Accra+Ghana&output=embed"
            className="absolute inset-0 w-full h-full grayscale-[30%] contrast-105"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute top-6 left-6 max-w-xs bg-[#0a0e1a] text-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-[#0d9488]" />
              <span className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488]">Head Office</span>
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
              className="inline-flex items-center gap-2 mt-4 text-xs tracking-[0.2em] uppercase text-[#0d9488] hover:text-white transition-colors"
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
