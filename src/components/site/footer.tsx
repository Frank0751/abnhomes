"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Instagram, Facebook, Phone, Mail, MapPin, ArrowUp } from "lucide-react";
import { COMPANY } from "@/lib/abn-data";

const tiktokIcon = (className: string) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.26z" />
  </svg>
);

const footerNav = {
  Company: [
    { label: "Our Story", href: "/about" },
    { label: "Residences", href: "/residences" },
    { label: "Own a Home", href: "/own" },
    { label: "Rent a Home", href: "/rent" },
    { label: "Gallery", href: "/gallery" },
    { label: "Locations", href: "/locations" },
  ],
  Residences: [
    { label: "Tantra Hill Penthouse", href: "/residences" },
    { label: "Achimota Estate", href: "/residences" },
    { label: "Furnished 1BR", href: "/residences" },
    { label: "Book a Tour", href: "/contact" },
  ],
  Services: [
    { label: "Amenities", href: "/amenities" },
    { label: "Construction", href: "/amenities" },
    { label: "Land Sales", href: "/amenities" },
    { label: "Renovations", href: "/amenities" },
  ],
  Connect: [
    { label: "Instagram", href: COMPANY.instagram, external: true },
    { label: "TikTok", href: COMPANY.tiktok, external: true },
    { label: "Facebook", href: COMPANY.facebook, external: true },
    { label: "WhatsApp", href: COMPANY.whatsapp, external: true },
  ],
};

export function Footer() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="relative bg-[#0a0e1a] text-white overflow-hidden">
      <div className="gold-divider" />

      <div className="max-w-[1400px] mx-auto px-5 lg:px-10 pt-20 pb-10">
        {/* Top CTA banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="grid lg:grid-cols-[2fr_1fr] gap-10 lg:gap-16 pb-16 border-b border-white/10"
        >
          <div>
            <img
              src="/images/logo/abn-homes-logo-real.png"
              alt="ABN Homes Company Limited"
              className="h-12 lg:h-14 w-auto mb-6 rounded"
            />
            <p className="font-serif text-2xl lg:text-3xl leading-tight max-w-2xl">
              Build your next chapter with a Ghanaian partner who treats your home as if it were their own.
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end lg:justify-end">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-3 px-7 py-4 bg-[#0d9488] hover:bg-[#14b8a6] text-white font-semibold tracking-[0.2em] uppercase text-sm transition-colors"
            >
              Book a Tour Today
            </Link>
            <a
              href={`tel:${COMPANY.phoneIntl}`}
              className="inline-flex items-center justify-center gap-2 text-white/70 hover:text-[#0d9488] text-sm tracking-wide transition-colors"
            >
              <Phone className="h-4 w-4" />
              {COMPANY.phone}
            </a>
          </div>
        </motion.div>

        {/* Footer body */}
        <div className="grid lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-10 lg:gap-12 py-16">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/images/logo/abn-badge.png"
                alt="ABN Homes monogram"
                className="h-12 w-12 rounded"
              />
              <div>
                <div className="font-serif text-xl">ABN Homes</div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#0d9488]">
                  Company Limited
                </div>
              </div>
            </div>
            <p className="text-sm text-white/65 leading-relaxed mb-6 max-w-sm">
              {COMPANY.fullName} is a Ghanaian real estate and construction company. We build and sell affordable houses, buy and sell lands, handle constructions, project management, architectural drawings, project supervising and renovations across Accra, Ghana.
            </p>
            <div className="space-y-2 text-sm text-white/65">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#0d9488] shrink-0 mt-0.5" />
                <span>{COMPANY.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#0d9488] shrink-0" />
                <a href={`tel:${COMPANY.phoneIntl}`} className="hover:text-[#0d9488] transition-colors">{COMPANY.phone}</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#0d9488] shrink-0" />
                <a href={`mailto:${COMPANY.email}`} className="hover:text-[#0d9488] transition-colors">{COMPANY.email}</a>
              </div>
            </div>

            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              <SocialLink href={COMPANY.instagram} label="Instagram">
                <Instagram className="h-4 w-4" />
              </SocialLink>
              <SocialLink href={COMPANY.tiktok} label="TikTok">
                {tiktokIcon("h-4 w-4")}
              </SocialLink>
              <SocialLink href={COMPANY.facebook} label="Facebook">
                <Facebook className="h-4 w-4" />
              </SocialLink>
            </div>
          </div>

          {/* Footer nav columns */}
          {Object.entries(footerNav).map(([title, items]) => (
            <div key={title}>
              <h4 className="text-[11px] tracking-[0.3em] uppercase text-[#0d9488] mb-5">
                {title}
              </h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center group"
                      >
                        <span className="w-0 h-px bg-[#0d9488] mr-0 group-hover:w-4 group-hover:mr-2 transition-all duration-300" />
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center group"
                      >
                        <span className="w-0 h-px bg-[#0d9488] mr-0 group-hover:w-4 group-hover:mr-2 transition-all duration-300" />
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xs text-white/45 text-center md:text-left">
            (c) {new Date().getFullYear()} {COMPANY.fullName}, a member of the ABN Group of Companies. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-xs text-white/45">
            <a href="#" className="hover:text-[#0d9488] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#0d9488] transition-colors">Terms</a>
            <button
              onClick={scrollTop}
              className="flex items-center gap-2 hover:text-[#0d9488] transition-colors"
            >
              Back to top
              <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-10 h-10 border border-white/15 hover:border-[#0d9488] hover:bg-[#0d9488]/10 flex items-center justify-center text-white/70 hover:text-[#0d9488] transition-all duration-300"
    >
      {children}
    </a>
  );
}
