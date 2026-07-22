"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BedDouble,
  Bath,
  Maximize,
  MapPin,
  ArrowRight,
  Check,
  Calendar,
  Camera,
} from "lucide-react";

type PropertyDetail = {
  id: string;
  name: string;
  location: string;
  status: string;
  description: string;
  longDescription: string;
  images: string[];
  floorPlan?: string;
  specs: { beds: number; baths: number; size: string };
  features: string[];
  price: string;
  priceUsd: number;
  highlights: string[];
};

const propertyDetails: Record<string, PropertyDetail> = {
  "tantra-hill": {
    id: "tantra-hill",
    name: "ABN Apartments, Tantra Hill",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "New Release",
    description:
      "Enjoy our 2 bedroom penthouse with a luxury and elegant touch. Comes with 75-inch Smart TVs and an oven for your grills, with an open rooftop bar for your BBQ parties.",
    longDescription:
      "ABN Apartments Tantra Hill is the home of the ABN Homes brand. Set on 8 Asiko Street in one of Accra's most connected neighbourhoods, the building houses a generously proportioned 2 bedroom penthouse designed for families, professionals on long assignments and discerning short stay guests. Every unit features a 75-inch Smart TV, a fully equipped kitchen with an oven for your grills, and an open rooftop bar for your BBQ parties. Secure parking, backup power and 24/7 security make everyday life effortless. Locate us on 8 Asiko Street on Bolt or Google Maps.",
    images: [
      "/images/abn-real/abn-ig-2-hd.jpg",
      "/images/abn-real/abn-ig-1-hd.jpg",
      "/images/abn-real/abn-ig-7-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-4-hd.jpg",
      "/images/abn-real/abn-ig-11-hd.jpg",
    ],
    specs: { beds: 2, baths: 2, size: "180 sqm" },
    features: ["75-inch Smart TV", "Open Rooftop Bar", "BBQ Oven", "Free WiFi", "Private Parking", "Air Conditioning", "24/7 Security", "Backup Power"],
    price: "From USD $70 / night",
    priceUsd: 220_000,
    highlights: [
      "2 bedroom penthouse with 75-inch Smart TVs",
      "Open rooftop bar for BBQ parties",
      "Fully equipped kitchen with grill oven",
      "Locate us on 8 Asiko Street on Bolt or Google Maps",
    ],
  },
  "achimota": {
    id: "achimota",
    name: "Achimota Petroleum Estate Residence",
    location: "Achimota Petroleum Estate, Accra",
    status: "Available",
    description:
      "4 bedrooms ensuite with 2 halls and a spacious compound in a serene environment for rent.",
    longDescription:
      "This Achimota Petroleum Estate residence offers 4 bedrooms ensuite with 2 halls and a spacious compound in a serene environment. The home features modern glass-railed staircases, contemporary finishes throughout, and ample space for family living. Each bedroom comes with its own ensuite bathroom, and the two halls provide flexible spaces for living and dining. The compound is generous and secure, ideal for families seeking comfort and privacy in one of Accra's established residential areas. Contact us for viewing.",
    images: [
      "/images/abn-real/abn-ig-5-hd.jpg",
      "/images/abn-real/abn-ig-8-hd.jpg",
      "/images/abn-real/abn-ig-10-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-4-hd.jpg",
      "/images/abn-real/abn-ig-12-hd.jpg",
    ],
    specs: { beds: 4, baths: 4, size: "220 sqm" },
    features: ["4 Bedrooms Ensuite", "2 Halls", "Spacious Compound", "Serene Environment", "Glass Staircase", "Modern Finishes", "Secure Compound", "Family Friendly"],
    price: "From USD $120 / night",
    priceUsd: 165_000,
    highlights: [
      "4 bedrooms ensuite with 2 halls",
      "Spacious compound in serene environment",
      "Modern glass-railed staircase",
      "Available for rent, contact for viewing",
    ],
  },
  "furnished-1br": {
    id: "furnished-1br",
    name: "Furnished 1 Bedroom Apartment",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "Selling Fast",
    description:
      "Stay with us and feel at home. Our furnished 1 bedroom apartment with a luxury feel.",
    longDescription:
      "Stay with us and feel at home. This furnished 1 bedroom apartment comes with a luxury feel, complete with modern amenities, elegant interiors and the warmth of a true home. Perfect for short stays, business trips, holiday rentals or extended visits to Accra. The apartment features a comfortable bedroom, a modern living area with Smart TV, a fully equipped kitchen, and a clean contemporary bathroom. Call us on 054 170 4048 to book your stay. ABN Apartments on Google Map or 8 Asiko Street on Bolt.",
    images: [
      "/images/abn-real/abn-ig-8-hd.jpg",
      "/images/abn-real/abn-ig-1-hd.jpg",
      "/images/abn-real/abn-ig-7-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-10-hd.jpg",
      "/images/abn-real/abn-ig-12-hd.jpg",
    ],
    specs: { beds: 1, baths: 1, size: "85 sqm" },
    features: ["Fully Furnished", "Smart TV", "Modern Kitchen", "Air Conditioning", "Free WiFi", "Housekeeping Available", "24/7 Security", "Backup Power"],
    price: "From USD $50 / night",
    priceUsd: 115_000,
    highlights: [
      "Fully furnished 1 bedroom apartment",
      "Luxury feel with modern amenities",
      "Perfect for short stays and business trips",
      "Call 054 170 4048 to book",
    ],
  },
};

export function usePropertyDetail() {
  const [openId, setOpenId] = useState<string | null>(null);
  return {
    open: (id: string) => setOpenId(id),
    close: () => setOpenId(null),
    openId,
  };
}

export function PropertyDetailModal({
  propertyId,
  onClose,
}: {
  propertyId: string | null;
  onClose: () => void;
}) {
  const property = propertyId ? propertyDetails[propertyId] : null;
  const [activeImage, setActiveImage] = useState(0);
  const [showCalculator, setShowCalculator] = useState(false);

  return (
    <AnimatePresence>
      {property && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-[#0a0e1a]/95 backdrop-blur-md overflow-y-auto"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="fixed top-5 right-5 z-10 w-11 h-11 border border-white/20 hover:border-[#0d9488] text-white hover:bg-[#0d9488] hover:text-[#0a0e1a] flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <motion.div
            key={property.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4 }}
            className="max-w-6xl mx-auto px-5 lg:px-10 py-20 lg:py-24 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase font-medium bg-[#0d9488] text-[#0a0e1a]">
                  {property.status}
                </span>
                <span className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-white/60">
                  <MapPin className="h-3.5 w-3.5 text-[#0d9488]" />
                  {property.location}
                </span>
              </div>
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4">
                {property.name}
              </h2>
              <p className="text-white/65 text-lg leading-relaxed max-w-3xl">
                {property.longDescription}
              </p>
            </div>

            {/* Image gallery */}
            <div className="grid lg:grid-cols-[2fr_1fr] gap-3 mb-10">
              <div className="relative h-80 lg:h-[540px] overflow-hidden bg-[#141826]">
                <motion.div
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${property.images[activeImage]})` }}
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-white/80 bg-[#0a0e1a]/60 backdrop-blur-sm px-3 py-1.5">
                  <Camera className="h-3.5 w-3.5 text-[#0d9488]" />
                  {activeImage + 1} / {property.images.length}
                </div>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 h-80 lg:h-[540px] overflow-y-auto">
                {property.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`relative overflow-hidden bg-[#141826] ${
                      activeImage === i ? "ring-2 ring-[#0d9488]" : "opacity-60 hover:opacity-100"
                    } transition-all`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${img})` }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Specs and price */}
            <div className="grid lg:grid-cols-3 gap-px bg-white/10 border border-white/10 mb-10">
              <div className="bg-[#0a0e1a] p-6 text-center">
                <BedDouble className="h-6 w-6 text-[#0d9488] mx-auto mb-2" strokeWidth={1.5} />
                <div className="font-serif text-2xl">{property.specs.beds}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Bedrooms</div>
              </div>
              <div className="bg-[#0a0e1a] p-6 text-center">
                <Bath className="h-6 w-6 text-[#0d9488] mx-auto mb-2" strokeWidth={1.5} />
                <div className="font-serif text-2xl">{property.specs.baths}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Bathrooms</div>
              </div>
              <div className="bg-[#0a0e1a] p-6 text-center">
                <Maximize className="h-6 w-6 text-[#0d9488] mx-auto mb-2" strokeWidth={1.5} />
                <div className="font-serif text-2xl">{property.specs.size}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Floor Area</div>
              </div>
            </div>

            {/* Highlights */}
            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <div>
                <h3 className="font-serif text-2xl mb-5">Residence Highlights</h3>
                <ul className="space-y-3">
                  {property.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/75">
                      <Check className="h-4 w-4 text-[#0d9488] mt-1 shrink-0" strokeWidth={2} />
                      <span className="leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-serif text-2xl mb-5">Included Features</h3>
                <div className="flex flex-wrap gap-2">
                  {property.features.map((f) => (
                    <span
                      key={f}
                      className="px-3 py-1.5 text-xs border border-white/15 text-white/70 tracking-wide"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Price block */}
            <div className="bg-gradient-to-br from-[#141826] to-[#0a0e1a] border border-[#0d9488]/30 p-8 lg:p-10 mb-8">
              <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-2">
                    Pricing
                  </div>
                  <div className="font-serif text-3xl lg:text-4xl text-white mb-2">
                    {property.price}
                  </div>
                  <div className="text-sm text-white/60">
                    Purchase from <span className="text-[#0d9488] font-medium">USD ${property.priceUsd.toLocaleString()}</span>  -  rent to own plans available.
                  </div>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <button
                    onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0d9488] hover:bg-[#14b8a6] text-[#0a0e1a] font-semibold tracking-[0.2em] uppercase text-xs transition-colors"
                  >
                    Book a Tour
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowCalculator(!showCalculator)}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-white/30 hover:border-[#0d9488] text-white text-xs tracking-[0.2em] uppercase transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Estimate Mortgage
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showCalculator && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mt-6"
                  >
                    <PropertyCalculator priceUsd={property.priceUsd} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer note */}
            <div className="text-center text-sm text-white/50 pt-6 border-t border-white/10">
              All ABN homes include backup power, borehole water and 24/7 security. Speak to an advisor about custom builds and rent to own plans.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Inline compact calculator that reuses the MortgageCalculator logic with a fixed price
import { useMemo } from "react";
function PropertyCalculator({ priceUsd }: { priceUsd: number }) {
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [termYears, setTermYears] = useState(20);
  const [interestRate, setInterestRate] = useState(18.5);

  const { monthlyPayment, totalInterest, principal } = useMemo(() => {
    const principal = priceUsd * (1 - downPaymentPct / 100);
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = termYears * 12;
    if (monthlyRate === 0) {
      return { monthlyPayment: principal / numPayments, totalInterest: 0, principal };
    }
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    return {
      monthlyPayment,
      totalInterest: monthlyPayment * numPayments - principal,
      principal,
    };
  }, [priceUsd, downPaymentPct, termYears, interestRate]);

  const fmt = (usd: number) =>
    `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="border-t border-white/10 pt-6">
      <div className="grid sm:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-[10px] tracking-[0.2em] uppercase text-white/60 mb-2">
            Down Payment ({downPaymentPct}%)
          </label>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(parseInt(e.target.value))}
            className="w-full accent-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.2em] uppercase text-white/60 mb-2">
            Term ({termYears} yrs)
          </label>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={termYears}
            onChange={(e) => setTermYears(parseInt(e.target.value))}
            className="w-full accent-[#0d9488]"
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.2em] uppercase text-white/60 mb-2">
            Rate ({interestRate.toFixed(1)}%)
          </label>
          <input
            type="range"
            min={5}
            max={30}
            step={0.1}
            value={interestRate}
            onChange={(e) => setInterestRate(parseFloat(e.target.value))}
            className="w-full accent-[#0d9488]"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Monthly</div>
          <div className="font-serif text-xl text-[#0d9488]">{fmt(monthlyPayment)}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Principal</div>
          <div className="font-serif text-xl text-white">{fmt(principal)}</div>
        </div>
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/50">Interest</div>
          <div className="font-serif text-xl text-white">{fmt(totalInterest)}</div>
        </div>
      </div>
    </div>
  );
}
