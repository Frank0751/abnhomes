import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Gallery } from "@/components/site/gallery";
import { SocialFeed } from "@/components/site/social-feed";

export const metadata: Metadata = {
  title: "Gallery - Visual Tour of ABN Homes",
  description:
    "Step inside the ABN way of living. Browse real photos of our Tantra Hill penthouse, Achimota Petroleum Estate residence, living rooms, bedrooms, kitchens and exteriors across Accra.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        title="Step inside the ABN way of living."
        subtitle="Real photos from our Instagram @abn_homes and TikTok @greatpuffy. Browse exteriors, living rooms, bedrooms, kitchens and more across our Accra residences."
        bgImage="/images/abn-real/abn-ig-7-hd.jpg"
        breadcrumb="Gallery"
      />

      <Gallery />
      <SocialFeed />
    </main>
  );
}
