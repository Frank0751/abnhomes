import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { Contact } from "@/components/site/contact";
import { Newsletter } from "@/components/site/newsletter";

export const metadata: Metadata = {
  title: "Contact ABN Homes",
  description:
    "Book a tour, ask a question, or simply say hello. Call 054 170 4048, WhatsApp us, or visit 8 Asiko Street, Tantra Hill, Accra. We respond within 2 business hours.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      <PageHero
        title="Book a tour, ask a question, or simply say hello."
        subtitle="Whether you are ready to move this month or just starting to explore Accra, our advisors are here to help. Reach us by phone, WhatsApp, email or the form below."
        bgImage="/images/abn-real/abn-ig-8-hd.jpg"
        breadcrumb="Contact"
      />

      <Contact />
      <Newsletter />
    </main>
  );
}
