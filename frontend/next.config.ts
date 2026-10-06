import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next treats 127.0.0.1 as a different dev origin from localhost and then
  // answers the HMR socket with a raw "Unauthorized", so the page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@screenerpro/shared", "d3-force"],
  async redirects() {
    if (process.env.STUDIO_ONLY !== "1") return [];
    return [{ source: "/", destination: "/studio", permanent: false }];
  },
};

export default nextConfig;
