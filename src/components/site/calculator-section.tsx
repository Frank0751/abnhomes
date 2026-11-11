"use client";

import { motion } from "framer-motion";
import { Calculator as CalcIcon, TrendingDown } from "lucide-react";
import { MortgageCalculator } from "./mortgage-calculator";

export function Calculator() {
  return (
    <section className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-[#0d9488]/5 blur-3xl pointer-events-none" />
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 relative">
        <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 lg:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="lg:sticky lg:top-28"
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em] mb-6">
              Run the numbers, then make the call.
            </h2>
            <p className="text-[#3a3530] text-base md:text-lg leading-relaxed mb-8">
              Whether you are buying your first home in Accra or expanding an investment portfolio, the ABN mortgage estimator gives you an indicative monthly payment in seconds. Adjust the price, down payment, term and rate to find the configuration that fits your life.
            </p>

            <div className="space-y-4 mb-8">
              {[
                {
                  icon: CalcIcon,
                  title: "Built for Ghana",
                  body: "Defaults use typical Ghanaian mortgage rates and cedi or USD display.",
                },
                {
                  icon: TrendingDown,
                  title: "Rent to Own",
                  body: "Prefer to spread the purchase over time? Ask us about flexible rent to own plans.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="shrink-0 w-11 h-11 border border-[#0d9488]/40 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-[#0d9488]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="font-serif text-lg text-[#0a0e1a] mb-1">{item.title}</div>
                    <div className="text-sm text-[#6b6253] leading-relaxed">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-5 border border-[#e8e3d8] bg-white">
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488] mb-2">
                Preferred Lender Partners
              </div>
              <p className="text-sm text-[#3a3530] leading-relaxed">
                We work with Republic Bank, Stanbic Bank Ghana, Absa Bank Ghana and CalBank to structure your mortgage. Speak to an advisor for warm introductions and preferential rates.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <MortgageCalculator defaultPriceUsd={220_000} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
