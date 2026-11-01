import { BookingHero } from "@/components/site/booking-hero";
import { StayRooms } from "@/components/site/stay-rooms";

/**
 * The homepage is a booking funnel and nothing else: search first, rooms
 * with photos second, a human on WhatsApp third. Everything longer — the
 * story, the amenities, the gallery — lives on its own page.
 */
export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#faf8f3]">
      <BookingHero />
      <StayRooms />
    </main>
  );
}
