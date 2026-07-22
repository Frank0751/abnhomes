"use client";

import { motion } from "framer-motion";
import { PhoneCall, Calendar, KeyRound, HandHeart } from "lucide-react";

const steps = [
  {
    icon: PhoneCall,
    step: "01",
    title: "Reach Out",
    body: "Call 054 170 4048 or send us a message. Tell us what you are looking for, your timeline and your budget. An ABN advisor will respond within two hours and schedule a conversation at your convenience.",
  },
  {
    icon: Calendar,
    step: "02",
    title: "Tour in Person or Virtually",
    body: "Visit Tantra Hill, Sakumono or Nii Ayi Mensah, or take a guided video tour if you are abroad. We walk you through the residence, the neighbourhood and the ownership or rental terms in plain language.",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "Reserve and Finalise",
    body: "Once you have selected your residence, we issue a transparent reservation agreement and walk you through every clause. Our legal team handles the documentation, title verification and any transfer logistics.",
  },
  {
    icon: HandHeart,
    step: "04",
    title: "Move In and Settle",
    body: "Collect your keys, complete your snag list with our site team, and let ABN Group handle furniture, utilities and concierge if you wish. We stay in touch long after handover to keep your home running smoothly.",
  },
];

export function Process() {
  return (
    <section className="relative py-24 lg:py-32 bg-[#0a0e1a] text-white overflow-hidden">
      {/* Decorative dotted pattern */}


      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-end mb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-px bg-[#0d9488]" />
              <span className="text-[11px] tracking-[0.4em] text-[#0d9488] font-medium uppercase">
                How It Works
              </span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              From first call to front door, four considered steps.
            </h2>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-white/65 text-base md:text-lg leading-relaxed"
          >
            Buying or renting a home in Accra should feel structured and
            transparent. Our four step process keeps you informed at every
            stage, with a single point of contact from your first enquiry to
            the day you collect your keys.
          </motion.p>
        </div>

        {/* Steps grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              className="group bg-[#0a0e1a] p-8 lg:p-9 hover:bg-[#141826] transition-colors duration-300 relative"
            >
              {/* Connector arrow */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 z-10 w-6 h-6 bg-[#0a0e1a] border border-[#0d9488]/40 -translate-y-1/2 rotate-45 group-hover:border-[#0d9488] transition-colors" />
              )}

              <div className="flex items-start justify-between mb-7">
                <div className="w-14 h-14 border border-[#0d9488]/40 group-hover:border-[#0d9488] group-hover:bg-[#0d9488]/5 flex items-center justify-center transition-all duration-300">
                  <step.icon className="h-6 w-6 text-[#0d9488]" strokeWidth={1.5} />
                </div>
                <span className="font-serif text-5xl text-white/10 group-hover:text-[#0d9488]/30 transition-colors">
                  {step.step}
                </span>
              </div>

              <h3 className="font-serif text-2xl text-white mb-3">
                {step.title}
              </h3>
              <p className="text-sm text-white/65 leading-relaxed">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
