import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Gallery } from "@/components/site/gallery";
import { SocialFeed } from "@/components/site/social-feed";

export const metadata: Metadata = {
  title: "Gallery - Visual Tour of ABN Homes",
  description:
    "Step inside ABN Apartments at 8 Asiko Street, Tantra Hill: real photos of the penthouse, the apartments, living rooms, bedrooms, kitchens and the building.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#f5f7f5]">
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
