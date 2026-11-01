import { BookingHero } from "@/components/site/booking-hero";
import { About } from "@/components/site/about";
import { AvailableHomes } from "@/components/site/available-homes";
import { Properties } from "@/components/site/properties";
import { FeaturedSpotlight } from "@/components/site/featured-spotlight";
import { VideoShowcase } from "@/components/site/video-showcase";
import { Amenities } from "@/components/site/amenities";
import { Calculator } from "@/components/site/calculator-section";
import { Gallery } from "@/components/site/gallery";
import { Locations } from "@/components/site/locations";
import { Process } from "@/components/site/process";
import { Testimonials } from "@/components/site/testimonials";
import { SocialFeed } from "@/components/site/social-feed";
import { Newsletter } from "@/components/site/newsletter";
import { Contact } from "@/components/site/contact";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#faf8f3]">
      <BookingHero />
      <About />
      <AvailableHomes />
      <Properties />
      <FeaturedSpotlight />
      <VideoShowcase />
      <Amenities />
      <Calculator />
      <Gallery />
      <Locations />
      <Process />
      <Testimonials />
      <SocialFeed />
      <Newsletter />
      <Contact />
    </main>
  );
}
