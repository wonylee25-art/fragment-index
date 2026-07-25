import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server accept requests proxied through `npm run tunnel` (LocalTunnel).
  allowedDevOrigins: ["*.loca.lt"],
};

export default nextConfig;
