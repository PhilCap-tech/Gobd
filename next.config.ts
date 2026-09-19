import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/readiness/**": ["./content/readiness/**/*"],
    "/readiness/**": ["./content/readiness/**/*"],
  },
};

export default nextConfig;
