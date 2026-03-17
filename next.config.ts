import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
