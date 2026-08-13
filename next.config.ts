import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "@imagemagick/magick-wasm", "archiver", "jszip"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
