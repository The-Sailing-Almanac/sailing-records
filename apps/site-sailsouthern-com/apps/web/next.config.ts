import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/blog/first-post",
        destination: "/",
        permanent: true,
      },
    ];
  },
  images: {
    // Next.js 16 requires explicit qualities allowlist
    qualities: [75, 90, 100],
    // Use WebP for all raster images
    formats: ["image/webp"],
  },
};

export default nextConfig;
