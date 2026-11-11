"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import { Play, ArrowUpRight } from "lucide-react";
import { COMPANY } from "@/lib/abn-data";

type Film = {
  src: string;
  poster: string;
  label: string;
  title: string;
  meta: string;
};

const films: Film[] = [
  {
    src: "/videos/tour-exterior.mp4",
    poster: "/images/abn-real/tour-exterior.jpg",
    label: "Exterior",
    title: "Gated Community",
    meta: "Tantra Hill, Accra",
  },
  {
    src: "/videos/tour-living.mp4",
    poster: "/images/abn-real/tour-living.jpg",
    label: "Living",
    title: "Open Plan Lounge",
    meta: "Furnished Residence",
  },
  {
    src: "/videos/tour-suite.mp4",
    poster: "/images/abn-real/tour-suite.jpg",
    label: "Suite",
    title: "Ensuite Comfort",
    meta: "1 Bedroom Apartment",
  },
  {
    src: "/videos/tour-kitchen.mp4",
    poster: "/images/abn-real/tour-kitchen.jpg",
    label: "Kitchen",
    title: "Fully Equipped",
    meta: "Chef Ready Kitchen",
  },
];

export function VideoShowcase() {
  return (
    <section
      id="film"
      className="relative overflow-hidden bg-[#0a0e1a] py-24 text-white lg:py-32"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-[#0d9488]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-8 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="max-w-2xl font-serif text-4xl leading-[1.05] tracking-[-0.02em] md:text-5xl lg:text-6xl">
              See the ABN Homes difference in full motion.
            </h2>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="max-w-md text-sm leading-relaxed text-white/60 lg:text-base"
          >
            Real walk-throughs of real ABN residences, filmed on location across
            Accra. Press play and step inside the finishes, the light and the
            space before you ever visit.
          </motion.p>
        </div>

        {/* Film grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {films.map((film, i) => (
            <FilmCard key={film.src} film={film} index={i} />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-8 sm:flex-row"
        >
          <p className="text-center text-sm text-white/60 sm:text-left">
            Prefer a private, guided video tour? Our team will walk you through
            any residence live.
          </p>
          <a
            href={COMPANY.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 bg-[#0d9488] px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-[#0a0e1a] transition-all duration-300 hover:bg-[#14b8a6]"
          >
            Book a Guided Tour
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function FilmCard({ film, index }: { film: Film; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const play = () => {
    const v = videoRef.current;
    if (v) v.play().catch(() => {});
  };
  const pause = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      onMouseEnter={play}
      onMouseLeave={pause}
      className="group relative aspect-[3/4] overflow-hidden rounded-sm bg-white/5"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
        muted
        loop
        playsInline
        preload="none"
        poster={film.poster}
      >
        <source src={film.src} type="video/mp4" />
      </video>

      {/* Gradient + label */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/85 via-transparent to-[#0a0e1a]/10" />

      <div className="absolute left-3 top-3 bg-[#0a0e1a]/60 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.3em] text-[#0d9488]">
        {film.label}
      </div>

      {/* Play affordance (fades out on hover as the clip plays) */}
      <div className="absolute inset-0 flex items-center justify-center opacity-100 transition-opacity duration-300 group-hover:opacity-0">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-[#0a0e1a]/40 backdrop-blur-sm">
          <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" />
        </span>
      </div>

      <div className="absolute inset-x-4 bottom-4">
        <div className="font-serif text-base text-white sm:text-lg">
          {film.title}
        </div>
        <div className="mt-0.5 text-[11px] tracking-wide text-white/60">
          {film.meta}
        </div>
      </div>
    </motion.div>
  );
}
