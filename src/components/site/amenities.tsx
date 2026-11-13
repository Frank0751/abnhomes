"use client";

import { motion } from "framer-motion";
import {
  Wind,
  Car,
  TreePalm,
  Wifi,
  UtensilsCrossed,
  Wine,
  Tv,
  ShieldCheck,
  Flame,
  Droplets,
  Sun,
  Sparkles,
} from "lucide-react";
import { useI18n } from "./i18n";

const amenities = [
  {
    icon: Wind,
    titleKey: "amenity.ac",
    body: "Climate controlled living spaces with inverter units in every bedroom and the main lounge.",
  },
  {
    icon: Car,
    titleKey: "amenity.parking",
    body: "Dedicated secure parking on site for residents and complimentary guest bays for visitors.",
  },
  {
    icon: TreePalm,
    titleKey: "amenity.balcony",
    body: "Every residence opens onto a private balcony or terrace, calibrated for Accra's golden hour.",
  },
  {
    icon: Wifi,
    titleKey: "amenity.internet",
    body: "Fibre ready infrastructure with complimentary WiFi throughout common areas and residences.",
  },
  {
    icon: UtensilsCrossed,
    titleKey: "amenity.kitchen",
    body: "Engineered stone counters, premium cabinetry, full appliance package and thoughtful storage.",
  },
  {
    icon: Wine,
    titleKey: "amenity.bar",
    body: "A residents only bar and lounge at Tantra Hill, perfect for unwinding or hosting friends.",
  },
  {
    icon: Tv,
    titleKey: "amenity.entertainment",
    body: "Flat screen TV mounting, media wiring and ambient lighting pre configured in every living room.",
  },
  {
    icon: ShieldCheck,
    titleKey: "amenity.security",
    body: "Controlled access, on site personnel and monitored perimeter at every ABN community.",
  },
  {
    icon: Flame,
    titleKey: "amenity.power",
    body: "Automatic transfer to backup generators ensures you never miss a moment during grid outages.",
  },
  {
    icon: Droplets,
    titleKey: "amenity.water",
    body: "Independent borehole supply with treatment and storage keeps every residence running year round.",
  },
  {
    icon: Sun,
    titleKey: "amenity.solar",
    body: "Selected residences integrate solar to reduce running costs and lighten environmental impact.",
  },
  {
    icon: Sparkles,
    titleKey: "amenity.housekeeping",
    body: "Optional weekly housekeeping, laundry and concierge services for residents who want more time.",
  },
];

export function Amenities() {
  const { t } = useI18n();
  return (
    <section id="amenities" className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-end mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em]">
              {t("amenities.heading")}
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-[#3a3530] text-base md:text-lg leading-relaxed"
          >
            {t("amenities.sub")}
          </motion.p>
        </div>

        {/* Amenities grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#e8e3d8] border border-[#e8e3d8]">
          {amenities.map((amenity, i) => (
            <motion.div
              key={amenity.titleKey}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: (i % 4) * 0.08 }}
              className="group bg-[#faf8f3] hover:bg-white p-7 lg:p-8 transition-colors duration-300 relative"
            >
              <div className="w-12 h-12 border border-[#0d9488]/30 group-hover:border-[#0d9488] group-hover:bg-[#0d9488]/5 flex items-center justify-center mb-5 transition-all duration-300">
                <amenity.icon
                  className="h-6 w-6 text-[#0a0e1a] group-hover:text-[#0d9488] transition-colors duration-300"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="font-serif text-xl text-[#0a0e1a] mb-2.5">
                {t(amenity.titleKey)}
              </h3>
              <p className="text-sm text-[#6b6253] leading-relaxed">
                {amenity.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
