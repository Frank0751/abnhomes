"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
  {
    image: "/images/abn-real/abn-ig-1-hd.jpg",
    label: "Living Room",
    title: "Comfort, calibrated for living.",
    body: "Our living rooms feature 75-inch Smart TVs set into elegant wood slat panels, crystal chandeliers and warm recessed lighting. Every piece is chosen for the way it feels at the end of a long Accra day, inviting you to sink in and truly feel at home.",
  },
  {
    image: "/images/abn-real/abn-ig-6-hd.jpg",
    label: "Bedroom",
    title: "A bedroom that exhales.",
    body: "Upholstered headboards, layered bedding and soft curtains define every ABN bedroom. Ceiling fans keep the air moving, wood flooring adds warmth underfoot, and the palette stays quiet so rest comes easily, night after night.",
  },
  {
    image: "/images/abn-real/abn-ig-7-hd.jpg",
    label: "Kitchen",
    title: "Where the home gathers.",
    body: "Dark matte cabinetry, light wood flooring and a fully equipped kitchen with an oven for your grills. Whether it is a quiet breakfast or a dinner before a night out in Accra, the ABN kitchen is ready for both.",
  },
  {
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    label: "Building Exterior",
    title: "A contemporary address.",
    body: "The ABN Apartments exterior blends brown and cream tones with glass-railed balconies and dark-framed windows. Locate us on 8 Asiko Street on Bolt or Google Maps, with private parking and a secure compound for every resident.",
  },
];

export function FeaturedSpotlight() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  const next = () => setActive((a) => (a + 1) % slides.length);
  const prev = () => setActive((a) => (a - 1 + slides.length) % slides.length);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-[#0a0e1a] text-white overflow-hidden"
    >
      <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[#0d9488]/8 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-end mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              A closer look at the ABN interior signature.
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="flex items-end justify-between gap-6"
          >
            <p className="text-white/65 text-base leading-relaxed">
              Four spaces. One philosophy. Explore the living room, master
              suite, kitchen and exterior of our Tantra Hill flagship.
            </p>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={prev}
                aria-label="Previous"
                className="w-11 h-11 border border-white/20 hover:border-[#0d9488] hover:bg-[#0d9488]/5 flex items-center justify-center transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                aria-label="Next"
                className="w-11 h-11 border border-white/20 hover:border-[#0d9488] hover:bg-[#0d9488]/5 flex items-center justify-center transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Carousel */}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-stretch">
          {/* Image */}
          <motion.div
            key={`img-${active}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative h-[420px] lg:h-[640px] overflow-hidden bg-[#141826]"
          >
            <motion.div
              style={{ y: imageY }}
              className="absolute inset-0 -top-[8%] -bottom-[8%]"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${slides[active].image})` }}
              />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/60 via-transparent to-transparent" />

            {/* Top label */}
            <div className="absolute top-6 left-6 flex items-center gap-3">
              <span className="font-serif text-4xl text-[#0d9488]">
                {String(active + 1).padStart(2, "0")}
              </span>
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-white/70">
                  {slides[active].label}
                </div>
                <div className="text-xs text-white/40">of {slides.length}</div>
              </div>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            key={`txt-${active}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col justify-center"
          >
            <h3 className="font-serif text-3xl lg:text-4xl mb-5 leading-tight">
              {slides[active].title}
            </h3>
            <p className="text-white/70 text-base lg:text-lg leading-relaxed mb-8">
              {slides[active].body}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-2 mb-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="group flex-1 h-px bg-white/15 relative"
                  aria-label={`Slide ${i + 1}`}
                >
                  <span
                    className={`absolute left-0 top-0 h-full bg-[#0d9488] transition-all duration-500 ${
                      i === active ? "w-full" : "w-0 group-hover:w-1/3"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Mobile nav */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 border border-white/20 flex items-center justify-center"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="w-10 h-10 border border-white/20 flex items-center justify-center"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={() => document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" })}
              className="group inline-flex items-center gap-2 mt-6 text-sm font-medium tracking-[0.2em] uppercase text-[#0d9488] hover:text-white transition-colors self-start"
            >
              Book an in person tour
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
