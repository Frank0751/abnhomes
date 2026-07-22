import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/components/site/i18n";
import { Navigation } from "@/components/site/navigation";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://abnhomes.com.gh"),
  title: {
    default: "ABN Homes Company Limited | Luxury Apartments & Real Estate in Accra, Ghana",
    template: "%s | ABN Homes Company Limited",
  },
  description:
    "ABN Homes Company Limited designs, builds and manages exceptional luxury apartments and homes across Accra, Ghana. Discover Tantra Hill, Sakumono and Nii Ayi Mensah residences with premium amenities, contemporary architecture and trusted ownership.",
  keywords: [
    "ABN Homes",
    "ABN Apartments",
    "luxury apartments Accra",
    "real estate Ghana",
    "Tantra Hill apartments",
    "Sakumono estate",
    "Nii Ayi Mensah",
    "ABN Group of Companies",
    "Ghana property developer",
    "luxury homes Accra",
  ],
  authors: [{ name: "ABN Homes Company Limited" }],
  creator: "ABN Homes Company Limited",
  publisher: "ABN Homes Company Limited",
  icons: {
    icon: [{ url: "/images/logo/abn-badge.png", type: "image/png" }],
    apple: [{ url: "/images/logo/abn-badge.png" }],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "ABN Homes Company Limited | Luxury Real Estate in Accra, Ghana",
    description:
      "Discover thoughtfully designed luxury apartments and homes across Accra. Tantra Hill, Sakumono and Nii Ayi Mensah residences with world-class amenities.",
    url: "https://abnhomes.com.gh",
    siteName: "ABN Homes",
    images: [
      {
        url: "/images/abn-real/abn-ig-11-hd.jpg",
        width: 1200,
        height: 630,
        alt: "ABN Apartments Tantra Hill at dusk",
      },
    ],
    locale: "en_US",
    alternateLocale: ["fr_FR"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ABN Homes Company Limited | Luxury Real Estate in Accra, Ghana",
    description:
      "Discover thoughtfully designed luxury apartments and homes across Accra.",
    images: ["/images/abn-real/abn-ig-11-hd.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://abnhomes.com.gh",
    languages: {
      "en-US": "https://abnhomes.com.gh",
      "fr-FR": "https://abnhomes.com.gh/?lang=fr",
    },
  },
  category: "real estate",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "ABN Homes Company Limited",
  description:
    "Luxury apartments and homes developer in Accra, Ghana. Part of ABN Group of Companies.",
  url: "https://abnhomes.com.gh",
  logo: "https://abnhomes.com.gh/images/logo/abn-homes-logo-real.png",
  image: "https://abnhomes.com.gh/images/abn-real/abn-ig-11-hd.jpg",
  telephone: "+233541704048",
  email: "hello@abnhomes.com.gh",
  address: {
    "@type": "PostalAddress",
    streetAddress: "8 Asiko Street, Tantra Hill",
    addressLocality: "Accra",
    addressRegion: "Greater Accra",
    postalCode: "23321",
    addressCountry: "GH",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 5.6037,
    longitude: -0.187,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "08:00",
      closes: "18:00",
    },
  ],
  areaServed: [
    { "@type": "Place", name: "Tantra Hill, Accra" },
    { "@type": "Place", name: "Sakumono Estate, Accra" },
    { "@type": "Place", name: "Nii Ayi Mensah, Amasaman" },
  ],
  sameAs: [
    "https://www.instagram.com/abn_homes/",
    "https://www.tiktok.com/@greatpuffy",
    "https://www.facebook.com/ABNGROUPOFCOMPANIES",
  ],
  parentOrganization: {
    "@type": "Organization",
    name: "ABN Group of Companies",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${playfair.variable} ${inter.variable} ${cormorant.variable} antialiased bg-background text-foreground`}
      >
        <I18nProvider>
          <Navigation />
          {children}
          <Footer />
          <FloatingActions />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
