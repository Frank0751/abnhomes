/**
 * Shared ABN Homes data - real content extracted from Instagram (@abn_homes)
 * and TikTok (@greatpuffy), plus the official company bio.
 */

export const COMPANY = {
  name: "ABN Homes Company Ltd",
  fullName: "ABN Homes Company Limited",
  tagline: "Building Dreams in Every Home",
  bio: [
    "We Build and Sell affordable Houses",
    "We Buy and Sell Lands",
    "Constructions",
    "Project Management",
    "Architectural Drawings",
    "Project Supervising",
    "Renovations",
  ],
  phone: "054 170 4048",
  phoneIntl: "+233541704048",
  whatsapp: "https://wa.me/233541704048",
  email: "hello@abnhomes.com.gh",
  address: "8 Asiko Street, Tantra Hill, Accra, Ghana",
  instagram: "https://www.instagram.com/abn_homes/",
  tiktok: "https://www.tiktok.com/@greatpuffy",
  facebook: "https://www.facebook.com/ABNGROUPOFCOMPANIES",
  hours: "Mon to Sat, 8:00 AM to 6:00 PM GMT",
};

export type Property = {
  id: string;
  name: string;
  location: string;
  status: "Available" | "Selling Fast" | "New Release" | "Promo";
  shortDescription: string;
  longDescription: string;
  image: string;
  images: string[];
  specs: { beds: number; baths: number; size: string };
  features: string[];
  price: string;
  pricePerNight: number;
  highlights: string[];
  caption?: string;
};

export const properties: Property[] = [
  {
    id: "tantra-hill",
    name: "ABN Apartments, Tantra Hill",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "New Release",
    shortDescription:
      "Enjoy our 2 bedroom penthouse with a luxury and elegant touch. Comes with 75-inch Smart TVs and an oven for your grills, with an open rooftop bar for your BBQ parties.",
    longDescription:
      "ABN Apartments Tantra Hill is the home of the ABN Homes brand. Set on 8 Asiko Street in one of Accra's most connected neighbourhoods, the building houses a generously proportioned 2 bedroom penthouse designed for families, professionals on long assignments and discerning short stay guests. Every unit features a 75-inch Smart TV, a fully equipped kitchen with an oven for your grills, and an open rooftop bar for your BBQ parties. Secure parking, backup power and 24/7 security make everyday life effortless. Locate us on 8 Asiko Street on Bolt or Google Maps.",
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    images: [
      "/images/abn-real/abn-ig-2-hd.jpg",
      "/images/abn-real/abn-ig-1-hd.jpg",
      "/images/abn-real/abn-ig-7-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-4-hd.jpg",
      "/images/abn-real/abn-ig-11-hd.jpg",
    ],
    specs: { beds: 2, baths: 2, size: "180 sqm" },
    features: ["75-inch Smart TV", "Open Rooftop Bar", "BBQ Oven", "Free WiFi", "Private Parking", "Air Conditioning", "24/7 Security", "Backup Power"],
    price: "From USD $70 / night",
    pricePerNight: 70,
    highlights: [
      "2 bedroom penthouse with 75-inch Smart TVs",
      "Open rooftop bar for BBQ parties",
      "Fully equipped kitchen with grill oven",
      "Locate us on 8 Asiko Street on Bolt or Google Maps",
    ],
    caption: "Enjoy Our 2 bedroom Penthouse with a luxury and elegant touch. Comes with a 75inch Smart TVs and an Oven for ur grills. With an Open rooftop bar for ur BBQ parties #airbnb #realtor #apartment #accra",
  },
  {
    id: "achimota",
    name: "Achimota Petroleum Estate Residence",
    location: "Achimota Petroleum Estate, Accra",
    status: "Available",
    shortDescription:
      "4 bedrooms ensuite with 2 halls and a spacious compound in a serene environment for rent. Contact us for viewing.",
    longDescription:
      "This Achimota Petroleum Estate residence offers 4 bedrooms ensuite with 2 halls and a spacious compound in a serene environment. The home features modern glass-railed staircases, contemporary finishes throughout, and ample space for family living. Each bedroom comes with its own ensuite bathroom, and the two halls provide flexible spaces for living and dining. The compound is generous and secure, ideal for families seeking comfort and privacy in one of Accra's established residential areas. Contact us for viewing.",
    image: "/images/abn-real/abn-ig-5-hd.jpg",
    images: [
      "/images/abn-real/abn-ig-5-hd.jpg",
      "/images/abn-real/abn-ig-8-hd.jpg",
      "/images/abn-real/abn-ig-10-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-4-hd.jpg",
      "/images/abn-real/abn-ig-12-hd.jpg",
    ],
    specs: { beds: 4, baths: 4, size: "220 sqm" },
    features: ["4 Bedrooms Ensuite", "2 Halls", "Spacious Compound", "Serene Environment", "Glass Staircase", "Modern Finishes", "Secure Compound", "Family Friendly"],
    price: "From USD $120 / night",
    pricePerNight: 120,
    highlights: [
      "4 bedrooms ensuite with 2 halls",
      "Spacious compound in serene environment",
      "Modern glass-railed staircase",
      "Available for rent, contact for viewing",
    ],
    caption: "4 bedrooms Ensuite, 2 halls with spacious compound in a serene environment for rent. Contact me for viewing",
  },
  {
    id: "furnished-1br",
    name: "Furnished 1 Bedroom Apartment",
    location: "8 Asiko Street, Tantra Hill, Accra",
    status: "Selling Fast",
    shortDescription:
      "Stay with us and feel at home. Our furnished 1 bedroom apartment with a luxury feel, perfect for short stays and business trips.",
    longDescription:
      "Stay with us and feel at home. This furnished 1 bedroom apartment comes with a luxury feel, complete with modern amenities, elegant interiors and the warmth of a true home. Perfect for short stays, business trips, holiday rentals or extended visits to Accra. The apartment features a comfortable bedroom, a modern living area with Smart TV, a fully equipped kitchen, and a clean contemporary bathroom. Call us on 054 170 4048 to book your stay. ABN Apartments on Google Map or 8 Asiko Street on Bolt.",
    image: "/images/abn-real/abn-ig-8-hd.jpg",
    images: [
      "/images/abn-real/abn-ig-8-hd.jpg",
      "/images/abn-real/abn-ig-1-hd.jpg",
      "/images/abn-real/abn-ig-7-hd.jpg",
      "/images/abn-real/abn-ig-6-hd.jpg",
      "/images/abn-real/abn-ig-10-hd.jpg",
      "/images/abn-real/abn-ig-12-hd.jpg",
    ],
    specs: { beds: 1, baths: 1, size: "85 sqm" },
    features: ["Fully Furnished", "Smart TV", "Modern Kitchen", "Air Conditioning", "Free WiFi", "Housekeeping Available", "24/7 Security", "Backup Power"],
    price: "From USD $50 / night",
    pricePerNight: 50,
    highlights: [
      "Fully furnished 1 bedroom apartment",
      "Luxury feel with modern amenities",
      "Perfect for short stays and business trips",
      "Call 054 170 4048 to book",
    ],
    caption: "Stay with us and feel at home. 1 Bedroom Apartment #airbnb #dirtydecember",
  },
];

export type Amenity = {
  icon: string;
  title: string;
  body: string;
};

export const amenities: Amenity[] = [
  { icon: "Wind", title: "Air Conditioning", body: "Climate controlled living spaces with inverter units in every bedroom and the main lounge." },
  { icon: "Car", title: "Private Parking", body: "Dedicated secure parking on site for residents and complimentary guest bays for visitors." },
  { icon: "Tv", title: "75-inch Smart TVs", body: "Every penthouse comes with a 75-inch Smart TV set into elegant wood slat panels. Stream, cast and relax in style." },
  { icon: "Wifi", title: "High Speed Internet", body: "Fibre ready infrastructure with complimentary WiFi throughout common areas and residences." },
  { icon: "UtensilsCrossed", title: "Fully Equipped Kitchen", body: "Engineered stone counters, premium cabinetry, full appliance package including an oven for your grills." },
  { icon: "Wine", title: "Open Rooftop Bar", body: "Residents only rooftop bar at Tantra Hill, perfect for BBQ parties, sundowners and entertaining friends." },
  { icon: "Flame", title: "BBQ Oven", body: "Every penthouse kitchen includes a dedicated oven for grills, so your BBQ plans are always ready to go." },
  { icon: "ShieldCheck", title: "24/7 Security", body: "Controlled access, on site personnel and monitored perimeter at every ABN community." },
  { icon: "Zap", title: "Backup Power", body: "Automatic transfer to backup generators ensures you never miss a moment during grid outages." },
  { icon: "Building2", title: "Construction Services", body: "We Build and Sell affordable Houses. Full construction, project management and architectural drawings." },
  { icon: "MapPin", title: "Land Sales", body: "We Buy and Sell Lands across Accra and Greater Accra Region. Verified titles, ready to build." },
  { icon: "Hammer", title: "Renovations", body: "Project supervising and renovations by the ABN Homes team. Breathe new life into your existing property." },
];

export type GalleryShot = {
  src: string;
  title: string;
  category: string;
  caption?: string;
};

export const galleryShots: GalleryShot[] = [
  { src: "/images/abn-real/abn-ig-11-hd.jpg", title: "ABN Apartments Exterior", category: "Exterior", caption: "Our flagship furnished apartments at Tantra Hill, ready for short and long stays." },
  { src: "/images/abn-real/abn-ig-1-hd.jpg", title: "Penthouse Open Plan Living", category: "Living", caption: "A generous open plan lounge, dining and kitchen finished with a statement chandelier." },
  { src: "/images/abn-real/abn-ig-6-hd.jpg", title: "Cozy Bedroom", category: "Bedroom", caption: "Warm, restful bedrooms designed to make you feel at home from the first night." },
  { src: "/images/abn-real/abn-ig-7-hd.jpg", title: "Open Plan Kitchen", category: "Kitchen", caption: "Fully equipped kitchens with a 75-inch Smart TV and an oven for your grills." },
  { src: "/images/abn-real/abn-ig-2-hd.jpg", title: "Building Facade with Parking", category: "Exterior", caption: "Contemporary architecture with private parking, located on 8 Asiko Street." },
  { src: "/images/abn-real/abn-ig-4-hd.jpg", title: "Ensuite Bathroom", category: "Bath", caption: "Marble finished ensuite bathrooms with rainfall showers and modern fittings." },
  { src: "/images/abn-real/abn-ig-5-hd.jpg", title: "Master Ensuite Bedroom", category: "Bedroom", caption: "A serene master suite with a tufted headboard, climate control and soft light." },
  { src: "/images/abn-real/abn-ig-8-hd.jpg", title: "Chandelier Living Room", category: "Living", caption: "Statement chandeliers and layered lighting bring warmth to every ABN lounge." },
  { src: "/images/abn-real/abn-ig-3-hd.jpg", title: "Entrance and Arrival", category: "Exterior", caption: "A welcoming arrival experience into your fully furnished ABN residence." },
  { src: "/images/abn-real/abn-ig-10-hd.jpg", title: "Modern Kitchen Interior", category: "Kitchen", caption: "Sleek cabinetry and stone counters make every ABN kitchen a pleasure to cook in." },
  { src: "/images/abn-real/abn-ig-12-hd.jpg", title: "Furnished Lounge", category: "Living", caption: "Move-in ready lounges styled and furnished by the ABN Homes team." },
  { src: "/images/abn-real/abn-ig-9-hd.jpg", title: "Bright Bedroom Suite", category: "Bedroom", caption: "Bright, airy bedroom suites available for December bookings and beyond." },
  { src: "/images/properties/tantra4-living.jpg", title: "4 Bedroom Chandelier Lounge", category: "Living", caption: "The chandelier lounge inside our 4 bedroom en-suite home at Tantra Hill." },
  { src: "/images/properties/tantra4-atrium.jpg", title: "Double-Height Atrium", category: "Interior", caption: "A dramatic double-height atrium with pendant lighting and a glass-railed staircase." },
  { src: "/images/properties/tantra4-bedroom.jpg", title: "En-suite Bedroom, Tantra Hill", category: "Bedroom", caption: "A spacious en-suite bedroom with fitted wardrobes and air conditioning." },
  { src: "/images/properties/tantra4-compound.jpg", title: "Paved Compound at Dusk", category: "Exterior", caption: "A private paved compound with feature lighting, ready for evening arrivals." },
  { src: "/images/properties/semi3-lounge.jpg", title: "Mood Lit Lounge", category: "Living", caption: "Cove and mood lighting set the tone in our 3 bedroom semi furnished home." },
  { src: "/images/properties/semi3-bath.jpg", title: "Marble En-suite Bathroom", category: "Bath", caption: "A clean marble en-suite bathroom with modern fittings." },
  { src: "/images/properties/semi3-facade.jpg", title: "Semi Furnished Facade", category: "Exterior", caption: "The contemporary facade of our 3 bedroom en-suite semi furnished residence." },
  { src: "/images/properties/furn1-atrium.jpg", title: "Furnished Apartment Entrance", category: "Interior", caption: "The striking double-height entrance of our furnished 1 bedroom apartment." },
];

export type SocialPost = {
  platform: "Instagram" | "TikTok";
  handle: string;
  image: string;
  caption: string;
  likes: string;
  href: string;
};

export const socialPosts: SocialPost[] = [
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
    caption: "Promo ₵700 per day through the month of October. Make your reservations early and locate us on Google Maps at ABN Apartments.",
    likes: "1.5k",
    href: "https://www.instagram.com/abn_homes/",
  },
];

export type Service = {
  title: string;
  body: string;
};

export const services: Service[] = [
  { title: "Build and Sell Affordable Houses", body: "We Build and Sell affordable Houses across Accra and Greater Accra Region. From 1 bedroom apartments to 4 bedroom ensuite townhouses, every ABN home is built to a standard, not a price." },
  { title: "Buy and Sell Lands", body: "We Buy and Sell Lands with verified titles, ready to build. Our team handles the due diligence, documentation and transfer so you can buy with confidence." },
  { title: "Constructions", body: "Full construction services from foundation to handover. Our in-house team of engineers, masons and finishers deliver homes that hold their value for decades." },
  { title: "Project Management", body: "End-to-end project management for residential and commercial builds. We keep your project on time, on budget and on quality, with transparent reporting at every stage." },
  { title: "Architectural Drawings", body: "Architectural drawings and design services by our in-house architects. From concept sketches to construction-ready plans, we bring your vision to paper and beyond." },
  { title: "Project Supervising", body: "Independent project supervising for ongoing builds. We act as your eyes on site, ensuring contractors deliver to specification and quality standards are met." },
  { title: "Renovations", body: "Breathe new life into your existing property. From kitchen and bathroom upgrades to full home renovations, the ABN team handles everything from design to completion." },
  { title: "Furnished Short Stay", body: "Furnished 1, 2 and 4 bedroom apartments available for short and long stays. Call 054 170 4048 to book, locate us on 8 Asiko Street on Bolt or Google Maps." },
];

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
  rating: number;
};

export const testimonials: Testimonial[] = [
  {
    quote: "From the first viewing to the day we collected our keys, ABN Homes made the process feel personal. The Tantra Hill apartment exceeded every expectation and our family has never felt more at home in Accra.",
    author: "Mr. and Mrs. Mensah",
    role: "Owners, Tantra Hill",
    rating: 5,
  },
  {
    quote: "I have rented across three continents and the ABN Apartments experience is genuinely world class. The finishes, the staff, the responsiveness, it all feels like a five star residence rather than a rental.",
    author: "Adwoa Owusu",
    role: "Long stay resident, Tantra Hill",
    rating: 5,
  },
  {
    quote: "What sold me on the Achimota Petroleum Estate home was the build quality. Every detail has been thought through. As an engineer myself, I appreciate what goes on behind the walls. ABN delivers.",
    author: "Kwabena Asante",
    role: "Owner, Achimota Petroleum Estate",
    rating: 5,
  },
  {
    quote: "ABN Group helped us furnish and move in within two weeks of signing. That kind of turnkey service is rare in Accra. They have earned a customer for life and a recommendation to every colleague.",
    author: "Dr. Esi Boateng",
    role: "Tenant, Tantra Hill",
    rating: 5,
  },
];

export type ProcessStep = {
  step: string;
  title: string;
  body: string;
};

export const processSteps: ProcessStep[] = [
  {
    step: "01",
    title: "Reach Out",
    body: "Call 054 170 4048 or send us a message. Tell us what you are looking for, your timeline and your budget. An ABN advisor will respond within two hours and schedule a conversation at your convenience.",
  },
  {
    step: "02",
    title: "Tour in Person or Virtually",
    body: "Visit Tantra Hill or Achimota Petroleum Estate, or take a guided video tour if you are abroad. We walk you through the residence, the neighbourhood and the ownership or rental terms in plain language.",
  },
  {
    step: "03",
    title: "Reserve and Finalise",
    body: "Once you have selected your residence, we issue a transparent reservation agreement and walk you through every clause. Our legal team handles the documentation, title verification and any transfer logistics.",
  },
  {
    step: "04",
    title: "Move In and Settle",
    body: "Collect your keys, complete your snag list with our site team, and let ABN Group handle furniture, utilities and concierge if you wish. We stay in touch long after handover to keep your home running smoothly.",
  },
];

export type Location = {
  name: string;
  area: string;
  image: string;
  description: string;
  highlights: string[];
  distance: string;
};

export const locations: Location[] = [
  {
    name: "Tantra Hill",
    area: "Greater Accra",
    image: "/images/abn-real/abn-ig-11-hd.jpg",
    description:
      "Home to our flagship ABN Apartments at 8 Asiko Street. Tantra Hill is a rapidly growing residential enclave that blends quiet suburban calm with fast access to the airport, the city centre and the Independence Arch corridor. Locate us on Bolt or Google Maps.",
    highlights: [
      "7.5 mi to Kotoka Intl Airport",
      "8 mi to Kwame Nkrumah Park",
      "8.7 mi to Independence Arch",
    ],
    distance: "Central Accra in 25 minutes",
  },
  {
    name: "Achimota Petroleum Estate",
    area: "Accra",
    image: "/images/abn-real/abn-ig-5-hd.jpg",
    description:
      "Our 4 bedroom ensuite residence with 2 halls and a spacious compound in a serene environment. Achimota Petroleum Estate is an established residential area popular with families seeking space, security and easy access to central Accra.",
    highlights: [
      "4 bedrooms ensuite with 2 halls",
      "Spacious compound, serene environment",
      "Close to Achimota Mall",
    ],
    distance: "Central Accra in 20 minutes",
  },
  {
    name: "Accra Wide",
    area: "Greater Accra Region",
    image: "/images/abn-real/abn-ig-2-hd.jpg",
    description:
      "ABN Homes Company Limited operates across Accra, with furnished apartments and rental properties available for short and long stays. Whether you are visiting for business, a holiday, or relocating, we have a home for you. Call 054 170 4048 to book.",
    highlights: [
      "Short and long stay options",
      "Furnished apartments available",
      "24/7 security at every property",
    ],
    distance: "Available across Greater Accra",
  },
];
