"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Building2, Award, Handshake, ShieldCheck } from "lucide-react";

const stats = [
  { value: 3, suffix: "", label: "Homes Available Now" },
  { value: 7, suffix: "", label: "Services In House" },
  { value: 24, suffix: "/7", label: "On Site Security" },
  { value: 100, suffix: "%", label: "Vertically Integrated" },
];

const values = [
  {
    icon: Building2,
    title: "Architectural Integrity",
    body: "Every residence begins with a disciplined design philosophy. We work with architects who treat each plot of Accra land as a canvas, balancing natural light, ventilation and proportion to deliver homes that feel considered from the moment you step inside.",
  },
  {
    icon: ShieldCheck,
    title: "Built to Endure",
    body: "We source materials that perform under the Ghanaian climate and partner with engineers who supervise every pour, every fitting and every finish. The result is a residence that holds its value, its comfort and its character for decades.",
  },
  {
    icon: Handshake,
    title: "Owner First",
    body: "ABN Homes was founded on the principle that buying or renting a home should feel personal. From the first call to long after handover, our team remains a single message away for everything from maintenance to interior recommendations.",
  },
  {
    icon: Award,
    title: "Quiet Luxury",
    body: "We believe luxury lives in restraint. Warm timbers, calibrated lighting, generous ceiling heights and carefully curated palettes come together to create homes that feel elevated without ever feeling loud or impersonal.",
  },
];

export function About() {
  return (
    <section id="about" className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      {/* Subtle decorative texture */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[#0d9488]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[#0a0e1a]/5 blur-3xl pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-end mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em]">
              A Ghanaian home, built with a world of intention.
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="space-y-5 text-[#3a3530] text-base md:text-lg leading-relaxed"
          >
            <p>
              ABN Homes Company Limited is the real estate arm of the ABN Group
              of Companies, a Ghanaian conglomerate rooted in Accra for over a
              decade. What started as a small portfolio of apartment buildings
              in Tantra Hill has grown into a collection of residences across
              three of Accra&apos;s most desirable neighbourhoods, each sharing
              one unchanging belief: that a home should elevate the everyday.
            </p>
            <p>
              From the architectural drawings to the final coat of paint, every
              ABN residence is delivered by a single, accountable team. That
              vertical integration, paired with a deep understanding of the
              local market, allows us to offer luxury that is genuinely
              attainable and a purchase experience that is refreshingly human.
            </p>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#e8e3d8] border border-[#e8e3d8] mb-24"
        >
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} delay={i * 0.1} />
          ))}
        </motion.div>

        {/* Values grid */}
        <div className="grid md:grid-cols-2 gap-x-12 gap-y-14 lg:gap-x-20">
          {values.map((value, i) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: (i % 2) * 0.15 }}
              className="relative"
            >
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-14 h-14 border border-[#0d9488]/40 flex items-center justify-center bg-white">
                  <value.icon className="h-6 w-6 text-[#0d9488]" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-serif text-2xl md:text-3xl text-[#0a0e1a] mb-3">
                    {value.title}
                  </h3>
                  <p className="text-[#3a3530] text-base leading-relaxed">
                    {value.body}
                  </p>
                </div>
              </div>
              <div className="absolute top-0 -translate-y-3 right-0 font-serif text-[10rem] leading-none text-[#0d9488]/8 select-none pointer-events-none">
                {String(i + 1).padStart(2, "0")}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  // Seed with the final value so the correct number is always in the HTML
  // (SSR, no-JS and reduced-motion all show the real figure, never zero).
  const [count, setCount] = useState(value);

  useEffect(() => {
    if (!inView) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setCount(value);
      return;
    }
    const duration = 1800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="bg-[#faf8f3] p-8 lg:p-10 text-center"
    >
      <div className="font-serif text-5xl lg:text-6xl text-[#0a0e1a] font-semibold tracking-tight">
        {count}
        <span className="text-[#0d9488]">{suffix}</span>
      </div>
      <div className="mt-3 text-xs tracking-[0.25em] text-[#6b6253] uppercase font-medium">
        {label}
      </div>
    </motion.div>
  );
}
