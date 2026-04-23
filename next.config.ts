import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Optimizations for Vercel / Production build
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Setting the tracing root can help avoid scanning outside the project
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
