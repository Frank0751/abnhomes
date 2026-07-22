"use client";

import { motion } from "framer-motion";
import { Building2, MapPin, PencilRuler, Hammer, ShieldCheck, TrendingUp, Home, KeyRound } from "lucide-react";
import { services, COMPANY } from "@/lib/abn-data";
import Link from "next/link";

const serviceIcons = [Home, MapPin, Building2, PencilRuler, ShieldCheck, KeyRound, Hammer, TrendingUp];

export function ServicesShowcase() {
  return (
    <section className="py-24 lg:py-32 bg-[#0a0e1a] text-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
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
                What We Do
              </span>
              <span className="w-10 h-px bg-[#0d9488]" />
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] mb-6">
              Eight ways we serve Accra.
            </h2>
            <p className="text-white/65 text-base md:text-lg leading-relaxed">
              From the official ABN Homes bio. We Build and Sell affordable Houses, Buy and Sell Lands, and handle full construction, project management, architectural drawings, project supervising and renovations across Accra, Ghana.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {services.map((service, i) => {
            const Icon = serviceIcons[i] || Building2;
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: (i % 4) * 0.1 }}
                className="group bg-white/[0.03] border border-white/10 p-7 hover:border-[#0d9488]/40 hover:bg-white/[0.05] transition-all duration-300"
              >
                <div className="w-12 h-12 border border-[#0d9488]/40 group-hover:border-[#0d9488] group-hover:bg-[#0d9488]/10 flex items-center justify-center mb-5 transition-all">
                  <Icon className="h-6 w-6 text-[#0d9488]" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-xl mb-3 leading-tight">{service.title}</h3>
                <p className="text-sm text-white/65 leading-relaxed">{service.body}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="mt-16 p-8 lg:p-12 border border-[#0d9488]/30 bg-[#0d9488]/5 text-center"
        >
          <h3 className="font-serif text-2xl md:text-3xl mb-4">Ready to build, buy, rent or renovate?</h3>
          <p className="text-white/65 max-w-xl mx-auto mb-6">
            Call {COMPANY.phone} or visit us at {COMPANY.address}. Our team is ready to help you find or create your next home in Accra.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-7 py-4 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Start a Conversation
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
