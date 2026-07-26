import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@medivi/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
