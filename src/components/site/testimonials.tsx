"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "From the first viewing to the day we collected our keys, ABN Homes made the process feel personal. The Tantra Hill apartment exceeded every expectation and our family has never felt more at home in Accra.",
    author: "Mr. and Mrs. Mensah",
    role: "Owners, Tantra Hill",
    rating: 5,
  },
  {
    quote:
      "I have rented across three continents and the ABN Apartments experience is genuinely world class. The finishes, the staff, the responsiveness, it all feels like a five star residence rather than a rental.",
    author: "Adwoa Owusu",
    role: "Long stay resident, Tantra Hill",
    rating: 5,
  },
  {
    quote:
      "What sold me on the Nii Ayi Mensah townhome was the build quality. Every detail has been thought through. As an engineer myself, I appreciate what goes on behind the walls. ABN delivers.",
    author: "Kwabena Asante",
    role: "Owner, Nii Ayi Mensah",
    rating: 5,
  },
  {
    quote:
      "ABN Group helped us furnish and move in within two weeks of signing. That kind of turnkey service is rare in Accra. They have earned a customer for life and a recommendation to every colleague.",
    author: "Dr. Esi Boateng",
    role: "Owner, Sakumono Estate",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="absolute top-1/3 left-0 w-72 h-72 rounded-full bg-[#0d9488]/8 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em]">
              The people who call ABN home.
            </h2>
          </motion.div>
        </div>

        {/* Testimonial grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((t, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: (i % 2) * 0.12 }}
              className="relative bg-white border border-[#e8e3d8] p-8 lg:p-10 group hover:border-[#0d9488]/40 transition-colors duration-500"
            >
              <Quote className="absolute top-6 right-6 h-12 w-12 text-[#0d9488]/15 group-hover:text-[#0d9488]/30 transition-colors" />

              <div className="flex gap-1 mb-5">
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Star key={si} className="h-4 w-4 fill-[#0d9488] text-[#0d9488]" />
                ))}
              </div>

              <blockquote className="font-display text-xl lg:text-2xl text-[#0a0e1a] leading-relaxed mb-7">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <figcaption className="flex items-center gap-4 pt-5 border-t border-[#e8e3d8]">
                <div className="w-11 h-11 rounded-full bg-[#0a0e1a] text-[#0d9488] flex items-center justify-center font-serif text-lg">
                  {t.author.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="font-serif text-lg text-[#0a0e1a]">{t.author}</div>
                  <div className="text-xs tracking-[0.15em] uppercase text-[#6b6253]">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#e8e3d8] border border-[#e8e3d8]"
        >
          {[
            { label: "Average owner rating", value: "4.9 / 5" },
            { label: "Referrals among owners", value: "82%" },
            { label: "Repeat ABN buyers", value: "1 in 4" },
            { label: "Avg. response time", value: "< 2 hrs" },
          ].map((s, i) => (
            <div key={i} className="bg-[#faf8f3] p-7 text-center">
              <div className="font-serif text-3xl lg:text-4xl text-[#0a0e1a] mb-1">{s.value}</div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#6b6253]">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
