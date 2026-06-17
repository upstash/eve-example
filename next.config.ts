import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't mis-infer it (e.g. as ./app).
  turbopack: { root: import.meta.dirname },
};

export default withEve(nextConfig);
