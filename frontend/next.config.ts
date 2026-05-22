import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@screenerpro/shared", "d3-force"],
};

export default nextConfig;
