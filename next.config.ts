import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '**',
      },
    ],
  },
  // Optimizations for Vercel / Production build
  compiler: {
    removeConsole: false, // Disabled for debugging audit logs
  },
  // Setting the tracing root can help avoid scanning outside the project
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
