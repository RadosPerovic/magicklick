import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.MAGIC_KLICK_RUNTIME === "node" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
