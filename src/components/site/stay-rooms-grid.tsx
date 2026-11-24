"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BedDouble, MessageCircle, Phone, Users } from "lucide-react";
import { COMPANY } from "@/lib/abn-data";
import { formatMinor } from "@/lib/core/money";
import type { Currency } from "@prisma/client";

export type StayCard = {
  key: string;
  name: string;
  /** How many identical rooms this card stands for. */
  count: number;
  beds: number;
  sleeps: number;
  nightlyMinor: number;
  currency: Currency;
  images: string[];
  /** The room's own page, or null for a group (which goes to the search). */
  href: string | null;
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Tomorrow for two nights: a search that always has a real answer. */
function searchHref(sleeps: number) {
  const from = new Date();
  from.setDate(from.getDate() + 1);
  const to = new Date(from);
  to.setDate(to.getDate() + 2);
  return `/book?checkIn=${iso(from)}&checkOut=${iso(to)}&guests=${Math.min(sleeps, 2)}`;
}

/**
 * A guest here to book wants three things: the room, the price, the button.
 * Photos carry the persuasion; the copy stays out of the way.
 */
export function StayRoomsGrid({ cards }: { cards: StayCard[] }) {
  return (
    <section id="rooms" className="relative bg-[#f5f7f5] py-16 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mb-10 flex flex-col gap-3 text-center lg:mb-14"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00a878]">
            ABN Apartments · 8 Asiko Street, Tantra Hill
          </p>
          <h2 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-[#0c1a16] md:text-5xl">
            Choose your stay
          </h2>
        </motion.div>

        {cards.length === 0 ? (
          <p className="mx-auto max-w-md text-center text-sm text-[#2d433b]">
            Our rooms are being updated. Message us on WhatsApp and we will find you a stay.
          </p>
        ) : (
          <div
            className={
              cards.length >= 4
                ? "grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
                : "mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {cards.map((card, i) => {
              const href = card.href ?? searchHref(card.sleeps);
              return (
                <motion.article
                  key={card.key}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="group relative flex flex-col overflow-hidden border border-[#dce5e0] bg-white shadow-[0_10px_40px_-24px_rgba(12,26,22,0.35)] transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(12,26,22,0.5)]"
                >
                  {/* Photo: the second image fades in on hover where one exists */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#0c1a16]">
                    {card.images[0] && (
                      <Image
                        src={card.images[0]}
                        alt={card.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    )}
                    {card.images[1] && (
                      <Image
                        src={card.images[1]}
                        alt={`${card.name}, another view`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0c1a16]/80 via-transparent to-transparent" />

                    <span className="absolute right-3 top-3 bg-[#f5f7f5]/95 px-2.5 py-1 text-xs font-semibold text-[#0c1a16]">
                      {formatMinor(card.nightlyMinor, card.currency).replace(/\.00$/, "")}
                      <span className="font-normal text-[#5a6b64]"> / night</span>
                    </span>

                    {card.count > 1 && (
                      <span className="absolute left-3 top-3 bg-[#0c1a16]/85 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
                        {card.count} available
                      </span>
                    )}

                    <div className="absolute inset-x-4 bottom-3">
                      <h3 className="font-serif text-2xl leading-tight text-white">
                        {/* The whole card is the link; the heading carries it. */}
                        <Link href={href} className="after:absolute after:inset-0 after:content-['']">
                          {card.name}
                        </Link>
                      </h3>
                      <p className="mt-1 flex items-center gap-3 text-xs text-white/85">
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="size-3.5 text-[#1fd39a]" />
                          {card.beds === 0 ? "Open plan" : `${card.beds} bedroom${card.beds > 1 ? "s" : ""}`}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5 text-[#1fd39a]" />
                          sleeps {card.sleeps}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="flex items-center justify-center gap-2 bg-[#0c1a16] py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-300 group-hover:bg-[#00a878] group-hover:text-[#0c1a16]">
                    {card.href ? "See photos and book" : "Check availability"}
                    <ArrowRight className="size-4" />
                  </span>
                </motion.article>
              );
            })}
          </div>
        )}

        {/* One line, two ways to reach a human */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-[#2d433b]"
        >
          <span>Prefer to talk?</span>
          <a
            href={`${COMPANY.whatsapp}?text=${encodeURIComponent("Hello ABN Homes, I would like to book a stay.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm bg-[#00a878] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-[#f5f7f5] transition-colors hover:bg-[#0c1a16] hover:text-white"
          >
            <MessageCircle className="size-4" />
            WhatsApp us
          </a>
          <a
            href={`tel:${COMPANY.phoneIntl}`}
            className="inline-flex items-center gap-2 rounded-sm border border-[#0c1a16]/25 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-[#0c1a16] transition-colors hover:border-[#00a878] hover:text-[#00a878]"
          >
            <Phone className="size-4" />
            {COMPANY.phone}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
