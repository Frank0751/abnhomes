import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Prisma ships a separate build for the workerd runtime, and OpenNext has to
  // reach it at its default location to patch it in. Keeping both packages out
  // of Next's bundle is what lets that happen. Next already treats
  // @prisma/client this way on Node, so on Vercel this changes nothing.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "scontent.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "p16-common-sign.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "p19-common-sign.tiktokcdn.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Room photos uploaded from the admin console, in Supabase Storage.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
    // Room photos are resized in the browser to about 2000px before upload,
    // which lands well under this; the default 1 MB was too tight for a
    // detailed photo. Kept under the 4.5 MB a Vercel function accepts.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
