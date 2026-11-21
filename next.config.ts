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
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
