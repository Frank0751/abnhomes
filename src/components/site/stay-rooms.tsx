import { db } from "@/lib/db";
import { unitSlug } from "@/lib/marketplace/units";
import { StayRoomsGrid, type StayCard } from "./stay-rooms-grid";

/**
 * The homepage below the hero: the homes that can be booked today, read from
 * the booking system on every refresh. Nothing here is typed in by hand, so
 * a price or a name can never drift from what checkout charges. (It used to
 * be a hard-coded list, and it went on advertising rooms and prices that no
 * longer existed.)
 *
 * Rooms that are the same kind at the same price are shown once, as "4
 * available", rather than as four cards a guest cannot tell apart. A home
 * that is one of a kind gets its own card and links to its own page.
 */

const TYPE_NAMES: Record<string, { one: string; many: string }> = {
  STUDIO: { one: "Studio", many: "Studios" },
  ONE_BED: { one: "One-Bedroom Apartment", many: "One-Bedroom Apartments" },
  TWO_BED: { one: "Two-Bedroom Apartment", many: "Two-Bedroom Apartments" },
  THREE_BED: { one: "Three-Bedroom Apartment", many: "Three-Bedroom Apartments" },
  FOUR_BED: { one: "Four-Bedroom Home", many: "Four-Bedroom Homes" },
  PENTHOUSE: { one: "Penthouse", many: "Penthouses" },
  TOWNHOUSE: { one: "Townhouse", many: "Townhouses" },
  DETACHED: { one: "House", many: "Houses" },
};

async function bookableRooms() {
  // The build that proves the Cloudflare bundle runs with no database at all.
  // There the page is built empty and filled on its first refresh.
  if (!process.env.DATABASE_URL) return [];

  return db.unit.findMany({
    where: {
      published: true,
      isAmenity: false,
      lettingMode: { in: ["SHORT_STAY", "BOTH"] },
      status: { notIn: ["OFF_MARKET"] },
      baseNightlyMinor: { not: null },
      property: { published: true, active: true },
    },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
      type: true,
      bedrooms: true,
      maxGuests: true,
      baseNightlyMinor: true,
      currency: true,
      images: true,
      sortOrder: true,
      property: { select: { slug: true } },
    },
    orderBy: [{ sortOrder: "asc" }],
  });
}

export async function StayRooms() {
  const rooms = await bookableRooms();

  // Same kind, same size, same price: one card.
  const groups = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const key = [room.type, room.bedrooms, room.maxGuests, room.baseNightlyMinor, room.currency].join("|");
    groups.set(key, [...(groups.get(key) ?? []), room]);
  }

  const cards: StayCard[] = [...groups.values()].map((group) => {
    // The room with the most photographs speaks for the group.
    const byPhotos = [...group].sort((a, b) => b.images.length - a.images.length);
    const lead = byPhotos[0];
    const single = group.length === 1;
    const names = TYPE_NAMES[lead.type];
    return {
      key: lead.id,
      name: single ? lead.name : (names?.many ?? lead.name),
      count: group.length,
      // A studio is one open room; calling it "1 bedroom" oversells it.
      beds: lead.type === "STUDIO" ? 0 : lead.bedrooms,
      sleeps: lead.maxGuests,
      nightlyMinor: lead.baseNightlyMinor ?? 0,
      currency: lead.currency,
      // One of a kind: its own first two photos. Several rooms: one cover
      // from each, so the card shows more than one of the apartments.
      images: (single ? lead.images : [...new Set(byPhotos.map((r) => r.images[0]).filter(Boolean))]).slice(0, 2),
      // One of a kind: straight to its page. Several: to the search, which
      // shows whichever of them are free for the dates.
      href: single
        ? `/stays/${unitSlug(lead, lead.property)}`
        : `/book?type=${lead.type}&guests=${Math.min(lead.maxGuests, 2)}`,
    };
  });

  // Dearest first: the penthouse leads, the way a hotel leads with its suite.
  cards.sort((a, b) => b.nightlyMinor - a.nightlyMinor);

  return <StayRoomsGrid cards={cards} />;
}
