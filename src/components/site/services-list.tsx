"use client";

import { motion } from "framer-motion";
import { Building2, MapPin, PencilRuler, Hammer, ShieldCheck, KeyRound, Home, TrendingUp } from "lucide-react";
import { services, COMPANY } from "@/lib/abn-data";
import Link from "next/link";

const serviceIcons = [Home, MapPin, Building2, PencilRuler, ShieldCheck, KeyRound, Hammer, TrendingUp];

export function ServicesList() {
  return (
    <section className="py-24 lg:py-32 bg-[#0a0e1a] text-white">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-end mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              Full service real estate and construction.
            </h2>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-white/65 text-base lg:text-lg leading-relaxed"
          >
            ABN Homes Company Limited is more than a rental company. From the official company bio, we build and sell affordable houses, buy and sell lands, handle full constructions, project management, architectural drawings, project supervising and renovations across Accra, Ghana.
          </motion.p>
        </div>

        <div className="space-y-4">
          {services.map((service, i) => {
            const Icon = serviceIcons[i] || Building2;
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="group flex flex-col md:flex-row gap-5 md:gap-8 p-7 lg:p-8 border border-white/10 hover:border-[#0d9488]/40 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300"
              >
                <div className="flex items-start gap-5 md:w-1/3">
                  <div className="shrink-0 w-14 h-14 border border-[#0d9488]/40 group-hover:border-[#0d9488] group-hover:bg-[#0d9488]/10 flex items-center justify-center transition-all">
                    <Icon className="h-6 w-6 text-[#0d9488]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488]/70 mb-1">
                      Service {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="font-serif text-xl md:text-2xl">{service.title}</h3>
                  </div>
                </div>
                <p className="text-white/65 leading-relaxed md:w-2/3 md:pt-4">{service.body}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="mt-16 text-center p-8 lg:p-10 border border-[#0d9488]/30 bg-[#0d9488]/5"
        >
          <h3 className="font-serif text-2xl md:text-3xl mb-4">Have a project in mind?</h3>
          <p className="text-white/65 max-w-xl mx-auto mb-6">
            From a single room renovation to a full estate build, our team is ready. Call {COMPANY.phone} to discuss your project.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center px-7 py-4 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
          >
            Request a Quote
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
