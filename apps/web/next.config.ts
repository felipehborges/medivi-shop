import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@medivi/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      // Local MinIO (STORAGE_PROVIDER=s3) — admin-uploaded product images in dev/self-host.
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      // Vercel Blob (STORAGE_PROVIDER=vercel-blob) — production uploads.
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
