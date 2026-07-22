"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  BedDouble,
  Bath,
  Maximize,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { COMPANY } from "@/lib/abn-data";

type Media = { type: "image" | "video"; src: string; poster?: string; alt: string };

type Listing = {
  id: string;
  name: string;
  location: string;
  purpose: string;
  status: string;
  blurb: string;
  specs: { beds: number; baths: number; area: string };
  media: Media[];
};

const listings: Listing[] = [
  {
    id: "tantra-4bed",
    name: "4 Bedroom En-suite",
    location: "Tantra Hill, Accra",
    purpose: "For Sale",
    status: "Available",
    blurb:
      "A spacious 4 bedroom en-suite family home with a double-height atrium, glass-railed staircase, chandelier lounge and a paved compound with feature lighting.",
    specs: { beds: 4, baths: 4, area: "En-suite" },
    media: [
      { type: "image", src: "/images/properties/tantra4-living.jpg", alt: "4 bedroom living room with chandelier" },
      { type: "image", src: "/images/properties/tantra4-atrium.jpg", alt: "Double-height atrium with pendant lights" },
      { type: "image", src: "/images/properties/tantra4-bedroom.jpg", alt: "En-suite bedroom with fitted wardrobe" },
      { type: "image", src: "/images/properties/tantra4-hallway.jpg", alt: "Interior hallway" },
      { type: "image", src: "/images/properties/tantra4-compound.jpg", alt: "Paved compound with feature lighting" },
    ],
  },
  {
    id: "semi-3bed",
    name: "3 Bedroom En-suite, Semi Furnished",
    location: "Accra",
    purpose: "For Sale",
    status: "Semi Furnished",
    blurb:
      "A semi furnished 3 bedroom en-suite home with cove and mood lighting, a marble bathroom, generous windows and a private balcony overlooking the estate.",
    specs: { beds: 3, baths: 3, area: "En-suite" },
    media: [
      { type: "image", src: "/images/properties/semi3-lounge.jpg", alt: "Lounge with cove mood lighting" },
      { type: "image", src: "/images/properties/semi3-hall.jpg", alt: "Hall with pendant lighting" },
      { type: "image", src: "/images/properties/semi3-room1.jpg", alt: "Bright room with ceiling fan" },
      { type: "image", src: "/images/properties/semi3-room2.jpg", alt: "Air conditioned room" },
      { type: "image", src: "/images/properties/semi3-bath.jpg", alt: "Marble en-suite bathroom" },
      { type: "image", src: "/images/properties/semi3-facade.jpg", alt: "Building facade with balcony" },
    ],
  },
  {
    id: "furn-1bed",
    name: "1 Bedroom Furnished Apartment",
    location: "Accra",
    purpose: "For Rent",
    status: "Available",
    blurb:
      "A fully furnished 1 bedroom apartment ready to move into, with a styled living area, fitted wardrobe bedroom and a striking double-height entrance. Take the video tour.",
    specs: { beds: 1, baths: 1, area: "Furnished" },
    media: [
      { type: "video", src: "/videos/furn1-tour-a.mp4", poster: "/images/properties/furn1-tour-a.jpg", alt: "Video tour of the 1 bedroom apartment" },
      { type: "image", src: "/images/properties/furn1-atrium.jpg", alt: "Double-height entrance atrium" },
      { type: "video", src: "/videos/furn1-tour-b.mp4", poster: "/images/properties/furn1-tour-b.jpg", alt: "Furnished living area video tour" },
    ],
  },
];

export function AvailableHomes() {
  return (
    <section id="available" className="relative overflow-hidden bg-[#faf8f3] py-24 lg:py-32">
      <div className="pointer-events-none absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-[#0d9488]/5 blur-3xl" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-8 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-10 bg-[#0d9488]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#0d9488]">
                On the Market Now
              </span>
            </div>
            <h2 className="max-w-2xl font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-[#0a0e1a] md:text-5xl lg:text-6xl">
              Homes available today, straight from ABN.
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="max-w-md text-base leading-relaxed text-[#3a3530]"
          >
            Real properties on the market right now across Accra. Slide through
            every room, then reach out to arrange a viewing the same day.
          </motion.p>
        </div>

        {/* Listings */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {listings.map((listing, i) => (
            <ListingCard key={listing.id} listing={listing} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ListingCard({ listing, index }: { listing: Listing; index: number }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = listing.media.length;
  const current = listing.media[active];

  const go = useCallback(
    (dir: number) => setActive((p) => (p + dir + count) % count),
    [count],
  );

  // Auto-advance: images dwell 4s, videos dwell 9s
  useEffect(() => {
    if (paused) return;
    const dwell = current.type === "video" ? 9000 : 4000;
    const t = window.setTimeout(() => setActive((p) => (p + 1) % count), dwell);
    return () => window.clearTimeout(t);
  }, [active, count, current.type, paused]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.1 }}
      className="group flex flex-col overflow-hidden border border-[#e8e3d8] bg-white shadow-[0_10px_40px_-24px_rgba(10,14,26,0.35)]"
    >
      {/* Media slideshow */}
      <div
        className="relative aspect-[4/5] overflow-hidden bg-[#0a0e1a]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0"
          >
            {current.type === "video" ? (
              <video
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={current.poster}
                aria-label={current.alt}
              >
                <source src={current.src} type="video/mp4" />
              </video>
            ) : (
              <div
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${current.src})` }}
                role="img"
                aria-label={current.alt}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/70 via-transparent to-[#0a0e1a]/10" />

        {/* Status + purpose */}
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <span className="bg-[#0d9488] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-[#0a0e1a]">
            {listing.purpose}
          </span>
          <span className="bg-[#0a0e1a]/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-white backdrop-blur-sm">
            {listing.status}
          </span>
        </div>

        {/* Video badge */}
        {current.type === "video" && (
          <span className="absolute right-4 top-4 flex items-center gap-1.5 bg-[#0a0e1a]/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0d9488]" />
            Video
          </span>
        )}

        {/* Arrows */}
        <button
          onClick={() => go(-1)}
          aria-label="Previous image"
          className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-[#0a0e1a]/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-[#0d9488] hover:text-[#0a0e1a] group-hover:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next image"
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-[#0a0e1a]/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 hover:bg-[#0d9488] hover:text-[#0a0e1a] group-hover:opacity-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {listing.media.map((_, d) => (
            <button
              key={d}
              onClick={() => setActive(d)}
              aria-label={`Go to slide ${d + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                d === active ? "w-6 bg-[#0d9488]" : "w-1.5 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#6b6253]">
          <MapPin className="h-3.5 w-3.5 text-[#0d9488]" />
          {listing.location}
        </div>
        <h3 className="mb-3 font-serif text-2xl leading-tight text-[#0a0e1a]">
          {listing.name}
        </h3>
        <p className="mb-5 flex-1 text-sm leading-relaxed text-[#3a3530]">
          {listing.blurb}
        </p>

        <div className="mb-5 flex items-center gap-5 border-y border-[#e8e3d8] py-3 text-sm text-[#0a0e1a]">
          <span className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[#0d9488]" strokeWidth={1.5} />
            {listing.specs.beds} Bed
          </span>
          <span className="flex items-center gap-2">
            <Bath className="h-4 w-4 text-[#0d9488]" strokeWidth={1.5} />
            {listing.specs.baths} Bath
          </span>
          <span className="flex items-center gap-2">
            <Maximize className="h-4 w-4 text-[#0d9488]" strokeWidth={1.5} />
            {listing.specs.area}
          </span>
        </div>

        <a
          href={`${COMPANY.whatsapp}?text=${encodeURIComponent(
            `Hello ABN Homes, I am interested in the ${listing.name} (${listing.purpose}). Please share more details.`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group/btn inline-flex items-center justify-center gap-2 bg-[#0a0e1a] px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-[#0d9488] hover:text-[#0a0e1a]"
        >
          Enquire About This Home
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
        </a>
      </div>
    </motion.article>
  );
}
