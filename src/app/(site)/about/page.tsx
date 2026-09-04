import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { About } from "@/components/site/about";
import { Testimonials } from "@/components/site/testimonials";
import { Process } from "@/components/site/process";
import { ServicesShowcase } from "@/components/site/services-showcase";
import { COMPANY } from "@/lib/abn-data";

export const metadata: Metadata = {
  title: "About ABN Homes Company Limited",
  description:
    "ABN Homes Company Limited builds and sells affordable houses across Accra, Ghana. We buy and sell lands, handle constructions, project management, architectural drawings, project supervising and renovations. Building Dreams in Every Home.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        eyebrow="Our Story"
        title="Building Dreams in Every Home."
        subtitle="ABN Homes Company Limited is a Ghanaian real estate and construction company headquartered at 8 Asiko Street, Tantra Hill, Accra. We build, sell, rent and renovate homes, and we buy and sell lands across Greater Accra."
        bgImage="/images/abn-real/abn-ig-11-hd.jpg"
        breadcrumb="About"
      />

      <About />
      <ServicesShowcase />
      <Process />
      <Testimonials />
    </main>
  );
}
