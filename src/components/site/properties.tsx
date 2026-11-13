"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { BedDouble, Bath, Maximize, MapPin, ArrowUpRight, Eye } from "lucide-react";
import { PropertyDetailModal } from "./property-detail-modal";
import { useI18n } from "./i18n";

type Property = {
  id: string;
  name: string;
  location: string;
  status: "Available" | "Selling Fast" | "New Release";
  description: string;
  image: string;
  specs: { beds: number; baths: number; size: string };
  features: string[];
  price: string;
};

const properties: Property[] = [
  {
    id: "tantra-hill",
    name: "ABN Apartments, Tantra Hill",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "New Release",
    description:
      "Our flagship residence. Enjoy our 2 bedroom penthouse with a luxury and elegant touch, complete with 75-inch Smart TVs and an oven for your grills. With an open rooftop bar for your BBQ parties, this is where Accra living reaches its finest. Locate us on 8 Asiko Street on Bolt or Google Maps.",
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    specs: { beds: 2, baths: 2, size: "180 sqm" },
    features: ["75-inch Smart TV", "Open Rooftop Bar", "BBQ Ready", "Free WiFi", "Private Parking", "Air Conditioning"],
    price: "From USD $70 / night",
  },
  {
    id: "achimota",
    name: "Achimota Petroleum Estate Residence",
    location: "Achimota Petroleum Estate, Accra",
    status: "Available",
    description:
      "4 bedrooms ensuite with 2 halls and a spacious compound in a serene environment. This residence is available for rent and offers modern living with glass-railed staircases, contemporary finishes and room for the whole family. Contact us for viewing.",
    image: "/images/abn-real/abn-ig-5-hd.jpg",
    specs: { beds: 4, baths: 4, size: "220 sqm" },
    features: ["4 Bedrooms Ensuite", "2 Halls", "Spacious Compound", "Serene Environment", "Glass Staircase", "Modern Finishes"],
    price: "From USD $120 / night",
  },
  {
    id: "furnished-1br",
    name: "Furnished 1 Bedroom Apartment",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "Selling Fast",
    description:
      "Stay with us and feel at home. Our furnished 1 bedroom apartment comes with a luxury feel, complete with modern amenities, elegant interiors and the warmth of a true home. Perfect for short stays, business trips or holiday rentals in Accra.",
    image: "/images/abn-real/abn-ig-8-hd.jpg",
    specs: { beds: 1, baths: 1, size: "85 sqm" },
    features: ["Fully Furnished", "Smart TV", "Modern Kitchen", "Air Conditioning", "Free WiFi", "Housekeeping Available"],
    price: "From USD $50 / night",
  },
];

export function Properties() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { t } = useI18n();

  return (
    <section id="residences" className="relative py-24 lg:py-32 bg-[#0a0e1a] text-white overflow-hidden">

      <div className="absolute top-1/4 -left-32 w-[400px] h-[400px] rounded-full bg-[#0d9488]/10 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] max-w-2xl">
              {t("properties.heading")}
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-white/65 text-base lg:text-lg leading-relaxed max-w-md"
          >
            {t("properties.sub")}
          </motion.p>
        </div>

        <div className="space-y-8">
          {properties.map((property, i) => (
            <PropertyCard key={property.id} property={property} index={i} reverse={i % 2 === 1} onView={() => setActiveId(property.id)} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mt-20 flex flex-col md:flex-row items-center justify-between gap-6 p-8 lg:p-10 border border-white/10 bg-white/[0.02]"
        >
          <div>
            <h3 className="font-serif text-2xl md:text-3xl mb-2">
              {t("properties.tailoredTitle")}
            </h3>
            <p className="text-white/65 max-w-xl">
              {t("properties.tailoredBody")}
            </p>
          </div>
          <button
            onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
            className="shrink-0 inline-flex items-center gap-2 px-7 py-4 bg-[#0d9488] text-[#0a0e1a] font-semibold tracking-wide text-sm uppercase hover:bg-[#14b8a6] transition-colors"
          >
            {t("cta.speakToAdvisor")}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>

      <PropertyDetailModal propertyId={activeId} onClose={() => setActiveId(null)} />
    </section>
  );
}

const STATUS_KEYS: Record<Property["status"], string> = {
  Available: "status.available",
  "Selling Fast": "status.sellingFast",
  "New Release": "status.newRelease",
};

function PropertyCard({
  property,
  index,
  reverse,
  onView,
}: {
  property: Property;
  index: number;
  reverse: boolean;
  onView: () => void;
}) {
  const { t } = useI18n();
  return (
    <motion.article
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay: index * 0.05 }}
      className="group grid lg:grid-cols-2 gap-0 border border-white/10 bg-white/[0.02] overflow-hidden hover:border-[#0d9488]/40 transition-colors duration-500"
    >
      <div className={`relative h-72 lg:h-auto overflow-hidden cursor-pointer ${reverse ? "lg:order-2" : ""}`} onClick={onView}>
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[1200ms] ease-out group-hover:scale-105"
          style={{ backgroundImage: `url(${property.image})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/80 via-transparent to-transparent" />
        <div className="absolute top-5 left-5 flex items-center gap-3">
          <span className="px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase font-medium bg-[#0d9488] text-[#0a0e1a]">
            {t(STATUS_KEYS[property.status])}
          </span>
        </div>
        <div className="absolute top-5 right-5 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-white/70 bg-[#0a0e1a]/60 backdrop-blur-sm px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="h-3 w-3 text-[#0d9488]" />
          {t("cta.viewDetail")}
        </div>
        <div className="absolute bottom-5 left-5 right-5 flex items-center gap-2 text-white/85 text-xs tracking-[0.2em] uppercase">
          <MapPin className="h-3.5 w-3.5 text-[#0d9488]" />
          {property.location}
        </div>
      </div>

      <div className={`p-8 lg:p-12 flex flex-col justify-center ${reverse ? "lg:order-1" : ""}`}>
        <h3 className="font-serif text-3xl lg:text-4xl text-white mb-4 leading-tight">
          {property.name}
        </h3>
        <p className="text-white/65 leading-relaxed mb-7">
          {property.description}
        </p>

        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10 mb-7">
          <Spec icon={BedDouble} value={property.specs.beds} label={t("properties.bedrooms")} />
          <Spec icon={Bath} value={property.specs.baths} label={t("properties.bathrooms")} />
          <Spec icon={Maximize} value={property.specs.size} label={t("properties.floorArea")} isText />
        </div>

        <div className="flex flex-wrap gap-2 mb-7">
          {property.features.map((f) => (
            <span
              key={f}
              className="px-3 py-1.5 text-xs border border-white/15 text-white/70 tracking-wide"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-white/50 uppercase mb-1">
              {t("properties.pricing")}
            </div>
            <div className="font-serif text-xl text-[#0d9488]">{property.price}</div>
          </div>
          <button
            onClick={onView}
            className="inline-flex items-center gap-2 px-6 py-3 border border-white/30 hover:border-[#0d9488] hover:bg-[#0d9488] hover:text-[#0a0e1a] text-white font-medium text-sm tracking-wide transition-all duration-300"
          >
            {t("cta.viewDetail")}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function Spec({
  icon: Icon,
  value,
  label,
  isText,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-[#0a0e1a] p-4 text-center">
      <Icon className="h-5 w-5 text-[#0d9488] mx-auto mb-2" strokeWidth={1.5} />
      <div className="font-serif text-xl text-white">{value}</div>
      <div className="text-[10px] tracking-[0.2em] text-white/50 uppercase mt-1">
        {label}
      </div>
    </div>
  );
}
