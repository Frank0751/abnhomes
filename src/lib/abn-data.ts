/**
 * Company details and the list of services, used across the public site.
 *
 * Homes, prices, photos and locations are NOT kept here. They come from the
 * booking system, so the site can only ever show what can actually be booked.
 * (This file once held hand-typed listings; they went stale and advertised
 * homes and prices that did not exist.)
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
  email: "hello@abnhomesltd.com",
  address: "8 Asiko Street, Tantra Hill, Accra, Ghana",
  instagram: "https://www.instagram.com/abn_homes/",
  tiktok: "https://www.tiktok.com/@greatpuffy",
  facebook: "https://www.facebook.com/ABNGROUPOFCOMPANIES",
  hours: "Mon to Sat, 8:00 AM to 6:00 PM GMT",
};

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
  { title: "Furnished Short Stay", body: "A two-bedroom penthouse, one-bedroom apartments and a studio at ABN Apartments, 8 Asiko Street, Tantra Hill. Book online with live prices, or call 054 170 4048." },
];
