"use client";

import { motion } from "framer-motion";
import { Instagram, Play, Heart, ExternalLink } from "lucide-react";

const posts = [
  {
    platform: "Instagram",
    handle: "@abn_homes",
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    caption: "Enjoy our 2 bedrooms Penthouse and have a real feel of luxury. Locate us on 8 Asiko street on bolt or maps #airbnb #apartment",
    likes: "1.2k",
    href: "https://www.instagram.com/abn_homes/",
  },
  {
    platform: "TikTok",
    handle: "@greatpuffy",
    image: "/images/abn-real/abn-tt-6-hd.jpg",
    caption: "ABN Apartments in Accra. Book your stay and feel at home.",
    likes: "8.4k",
    href: "https://www.tiktok.com/@greatpuffy",
  },
  {
    platform: "Instagram",
    handle: "@abn_homes",
    image: "/images/abn-real/abn-ig-1-hd.jpg",
    caption: "Enjoy Our 2 bedroom Penthouse with a luxury and elegant touch. Comes with a 75inch Smart TVs and an Oven for ur grills. With an Open rooftop bar for ur BBQ parties #airbnb #realtor #apartment #accra",
    likes: "942",
    href: "https://www.instagram.com/abn_homes/",
  },
  {
    platform: "TikTok",
    handle: "@greatpuffy",
    image: "/images/abn-real/abn-tt-3-hd.jpg",
    caption: "Inside ABN Apartments. Modern living in Accra.",
    likes: "12.6k",
    href: "https://www.tiktok.com/@greatpuffy",
  },
  {
    platform: "Instagram",
    handle: "@abn_homes",
    image: "/images/abn-real/abn-ig-6-hd.jpg",
    caption: "Stay with us and feel at home. 1 Bedroom Available #airbnb #dirtydecember",
    likes: "768",
    href: "https://www.instagram.com/abn_homes/",
  },
  {
    platform: "Instagram",
    handle: "@abn_homes",
    image: "/images/abn-real/abn-ig-11-hd.jpg",
    caption: "Promo ₵700 per day through the month of October. Make your reservations early and locate us on Google Maps at ABN Apartments #airbnb #accra",
    likes: "1.5k",
    href: "https://www.instagram.com/abn_homes/",
  },
];

export function SocialFeed() {
  return (
    <section className="relative py-24 lg:py-32 bg-[#faf8f3] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 lg:px-10">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-14">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl text-[#0a0e1a] leading-[1.05] tracking-[-0.02em] max-w-2xl">
              ABN Homes, in motion.
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <a
              href="https://www.instagram.com/abn_homes/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#0a0e1a] text-white text-sm font-medium tracking-wide hover:bg-[#1a1f2e] transition-colors"
            >
              <Instagram className="h-4 w-4 text-[#0d9488]" />
              @abn_homes
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="https://www.tiktok.com/@greatpuffy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-6 py-3.5 border border-[#0a0e1a] text-[#0a0e1a] text-sm font-medium tracking-wide hover:bg-[#0a0e1a] hover:text-white transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.26z" />
              </svg>
              @greatpuffy
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </motion.div>
        </div>

        {/* Posts grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
          {posts.map((post, i) => (
            <motion.a
              key={i}
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
              className={`group relative aspect-[4/5] overflow-hidden bg-[#0a0e1a] ${
                i === 0 ? "md:row-span-2 md:aspect-auto" : ""
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-[1500ms] ease-out group-hover:scale-110"
                style={{ backgroundImage: `url(${post.image})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a]/90 via-[#0a0e1a]/20 to-transparent" />

              {/* Top badge */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {post.platform === "TikTok" ? (
                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43V8.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.26z" />
                  </svg>
                ) : (
                  <Instagram className="h-3.5 w-3.5 text-white" />
                )}
                <span className="text-[10px] tracking-[0.15em] text-white/85 font-medium">
                  {post.handle}
                </span>
              </div>

              {/* Play icon for TikTok */}
              {post.platform === "TikTok" && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center group-hover:bg-[#0d9488] transition-colors duration-300">
                  <Play className="h-5 w-5 text-white fill-white group-hover:text-[#0a0e1a] group-hover:fill-[#0a0e1a] ml-0.5" />
                </div>
              )}

              {/* Bottom content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
                <p className="text-white text-xs lg:text-sm leading-relaxed line-clamp-2 mb-2.5">
                  {post.caption}
                </p>
                <div className="flex items-center gap-1.5 text-white/70 text-xs">
                  <Heart className="h-3.5 w-3.5 text-[#0d9488] fill-[#0d9488]" />
                  <span>{post.likes}</span>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-10 text-center text-sm text-[#6b6253]"
        >
          Tag <span className="text-[#0d9488] font-medium">@abn_homes</span> in your ABN moments for a chance to be featured.
        </motion.div>
      </div>
    </section>
  );
}
