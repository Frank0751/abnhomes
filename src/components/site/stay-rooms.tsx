"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, MessageCircle, Phone, Users } from "lucide-react";
import { COMPANY } from "@/lib/abn-data";

/**
 * The whole homepage below the hero, on purpose.
 *
 * A guest here to book wants three things: the room, the price, the button.
 * Photos carry the persuasion; the copy stays out of the way. Every card
 * opens /book with dates and party size already filled in.
 */

type Room = {
  code: string;
  name: string;
  line: string;
  beds: number;
  sleeps: number;
  rate: number;
  images: string[];
};

const ROOMS: Room[] = [
  {
    code: "PH",
    name: "Tantra Hill Penthouse",
    line: "Rooftop bar · 75-inch TVs · BBQ oven",
    beds: 2,
    sleeps: 4,
    rate: 70,
    images: ["/images/abn-real/abn-ig-2-hd.jpg", "/images/abn-real/abn-ig-7-hd.jpg"],
  },
  {
    code: "A2",
    name: "Two Bedroom Apartment",
    line: "Balcony · Smart TV · Nightly or monthly",
    beds: 2,
    sleeps: 4,
    rate: 85,
    images: ["/images/abn-real/abn-ig-1-hd.jpg"],
  },
  {
    code: "A1",
    name: "Furnished One Bedroom",
    line: "Move-in ready · Ideal for business trips",
    beds: 1,
    sleeps: 2,
    rate: 50,
    images: ["/images/abn-real/abn-ig-8-hd.jpg"],
  },
  {
    code: "MAIN",
    name: "Achimota Four Bedroom",
    line: "Four ensuite bedrooms · Serene compound",
    beds: 4,
    sleeps: 8,
    rate: 120,
    images: ["/images/abn-real/abn-ig-5-hd.jpg"],
  },
];

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StayRooms() {
  const router = useRouter();

  function bookRoom(room: Room) {
    const now = new Date();
    const out = new Date(now);
    out.setDate(out.getDate() + 2);
    router.push(
      `/book?checkIn=${iso(now)}&checkOut=${iso(out)}&guests=${room.sleeps}`,
    );
  }

  return (
    <section id="rooms" className="relative bg-[#faf8f3] py-16 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        {/* Header — one line each, then the rooms */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mb-10 flex flex-col gap-3 text-center lg:mb-14"
        >
          <h2 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-[#0a0e1a] md:text-5xl">
            Rooms available now
          </h2>
        </motion.div>

        {/* Room cards */}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {ROOMS.map((room, i) => (
            <motion.article
              key={room.code}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="group flex cursor-pointer flex-col overflow-hidden border border-[#e8e3d8] bg-white shadow-[0_10px_40px_-24px_rgba(10,14,26,0.35)] transition-shadow duration-300 hover:shadow-[0_24px_60px_-24px_rgba(10,14,26,0.5)]"
              onClick={() => bookRoom(room)}
            >
              {/* Photo — second image fades in on hover where one exists */}
              <div className="relative aspect-[4/5] overflow-hidden bg-[#0a0e1a]">
                <Image
                  src={room.images[0]}
                  alt={room.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                {room.images[1] && (
                  <Image
                    src={room.images[1]}
                    alt={`${room.name} — another view`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                    className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/75 via-transparent to-transparent" />

                <span className="absolute right-3 top-3 bg-[#faf8f3]/95 px-2.5 py-1 text-xs font-semibold text-[#0a0e1a]">
                  ${room.rate}
                  <span className="font-normal text-[#6b6253]"> / night</span>
                </span>

                <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-xl leading-tight text-white">
                      {room.name}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-3 text-[11px] text-white/80">
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="size-3.5 text-[#14b8a6]" />
                        {room.beds} bed{room.beds > 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5 text-[#14b8a6]" />
                        sleeps {room.sleeps}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* The action */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  bookRoom(room);
                }}
                className="flex items-center justify-center gap-2 bg-[#0a0e1a] py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-300 group-hover:bg-[#0d9488] group-hover:text-[#0a0e1a]"
              >
                Book this room
              </button>
            </motion.article>
          ))}
        </div>

        {/* One line, two ways to reach a human */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-[#3a3530]"
        >
          <span>Prefer to talk?</span>
          <a
            href={`${COMPANY.whatsapp}?text=${encodeURIComponent(
              "Hello ABN Homes, I would like to book a stay.",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm bg-[#0d9488] px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-[#faf8f3] transition-colors hover:bg-[#0a0e1a] hover:text-white"
          >
            <MessageCircle className="size-4" />
            WhatsApp us
          </a>
          <a
            href={`tel:${COMPANY.phoneIntl}`}
            className="inline-flex items-center gap-2 rounded-sm border border-[#0a0e1a]/25 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-[#0a0e1a] transition-colors hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            <Phone className="size-4" />
            {COMPANY.phone}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
