import type { NextConfig } from "next";
import path from "path";

/** Served under https://singleton-systems.com/wemby-shot-lab via multi-zone rewrites. */
const BASE_PATH = "/wemby-shot-lab";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: BASE_PATH,
  // Client fetch + public assets need this prefix
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
