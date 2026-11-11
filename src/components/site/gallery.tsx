"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";

type Shot = {
  src: string;
  title: string;
  category: "Exterior" | "Living" | "Bedroom" | "Kitchen" | "Bath";
  span: string;
};

const shots: Shot[] = [
  { src: "/images/abn-real/abn-ig-11-hd.jpg", title: "ABN Apartments Exterior", category: "Exterior", span: "lg:col-span-2 lg:row-span-2" },
  { src: "/images/abn-real/abn-ig-1-hd.jpg", title: "Penthouse Open Plan Living", category: "Living", span: "" },
  { src: "/images/abn-real/abn-ig-6-hd.jpg", title: "Cozy Bedroom", category: "Bedroom", span: "" },
  { src: "/images/abn-real/abn-ig-7-hd.jpg", title: "Open Plan Kitchen", category: "Kitchen", span: "" },
  { src: "/images/abn-real/abn-ig-2-hd.jpg", title: "Building Facade with Parking", category: "Exterior", span: "lg:col-span-2" },
  { src: "/images/abn-real/abn-ig-4-hd.jpg", title: "Ensuite Bathroom", category: "Bath", span: "" },
  { src: "/images/abn-real/abn-ig-5-hd.jpg", title: "Master Ensuite Bedroom", category: "Bedroom", span: "" },
  { src: "/images/abn-real/abn-ig-8-hd.jpg", title: "Chandelier Living Room", category: "Living", span: "" },
  { src: "/images/abn-real/abn-ig-3-hd.jpg", title: "Entrance and Arrival", category: "Exterior", span: "lg:col-span-2" },
  { src: "/images/abn-real/abn-ig-10-hd.jpg", title: "Modern Kitchen Interior", category: "Kitchen", span: "" },
  { src: "/images/abn-real/abn-ig-12-hd.jpg", title: "Furnished Lounge", category: "Living", span: "" },
  { src: "/images/abn-real/abn-ig-9-hd.jpg", title: "Bright Bedroom Suite", category: "Bedroom", span: "" },
  { src: "/images/properties/tantra4-living.jpg", title: "4 Bedroom Chandelier Lounge", category: "Living", span: "lg:col-span-2" },
  { src: "/images/properties/tantra4-atrium.jpg", title: "Double-Height Atrium", category: "Living", span: "" },
  { src: "/images/properties/tantra4-bedroom.jpg", title: "En-suite Bedroom, Tantra Hill", category: "Bedroom", span: "" },
  { src: "/images/properties/semi3-bath.jpg", title: "Marble En-suite Bathroom", category: "Bath", span: "" },
  { src: "/images/properties/semi3-facade.jpg", title: "Semi Furnished Facade", category: "Exterior", span: "" },
  { src: "/images/properties/tantra4-compound.jpg", title: "Paved Compound at Dusk", category: "Exterior", span: "lg:col-span-2" },
];

const categories = ["All", "Exterior", "Living", "Bedroom", "Kitchen", "Bath"] as const;

export function Gallery() {
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered = filter === "All" ? shots : shots.filter((s) => s.category === filter);

  const openLightbox = (index: number) => setLightbox(index);
  const closeLightbox = () => setLightbox(null);
  const next = () => setLightbox((i) => (i === null ? null : (i + 1) % filtered.length));
  const prev = () => setLightbox((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));

  return (
    <section id="gallery" className="relative py-24 lg:py-32 bg-[#0a0e1a] text-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] max-w-2xl">
              Step inside the ABN way of living.
            </h2>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-4 py-2 text-xs tracking-[0.2em] uppercase font-medium transition-all duration-300 ${
                  filter === c
                    ? "bg-[#0d9488] text-[#0a0e1a]"
                    : "border border-white/15 text-white/60 hover:text-white hover:border-white/40"
                }`}
              >
                {c}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Masonry grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 auto-rows-[200px] lg:auto-rows-[260px] gap-3 lg:gap-4">
          {filtered.map((shot, i) => (
            <motion.button
              key={shot.src + i}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              onClick={() => openLightbox(i)}
              className={`group relative overflow-hidden bg-white/5 ${shot.span}`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[1200ms] ease-out group-hover:scale-110"
                style={{ backgroundImage: `url(${shot.src})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/80 via-transparent to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-3 left-3 text-[10px] tracking-[0.3em] uppercase text-[#0d9488] font-medium bg-[#0a0e1a]/60 px-2 py-1">
                {shot.category}
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                <span className="font-serif text-lg text-white">{shot.title}</span>
                <ZoomIn className="h-4 w-4 text-[#0d9488] shrink-0" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0a0e1a]/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button
              className="absolute top-6 right-6 text-white/70 hover:text-[#0d9488] p-2"
              onClick={closeLightbox}
              aria-label="Close"
            >
              <X className="h-7 w-7" />
            </button>
            <button
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-[#0d9488] p-3 border border-white/20 hover:border-[#0d9488] transition-colors"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-[#0d9488] p-3 border border-white/20 hover:border-[#0d9488] transition-colors"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <motion.div
              key={lightbox}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="max-w-[90vw] max-h-[85vh] relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={filtered[lightbox].src}
                alt={filtered[lightbox].title}
                className="max-w-full max-h-[85vh] object-contain"
              />
              <div className="mt-4 text-center">
                <div className="font-serif text-xl text-white">{filtered[lightbox].title}</div>
                <div className="text-xs tracking-[0.3em] uppercase text-[#0d9488] mt-1">
                  {filtered[lightbox].category}  -  {lightbox + 1} / {filtered.length}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
