import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The sandbox preview iframe is cross-origin (Daytona's proxy rewrites Host).
  allowedDevOrigins: ['*.daytonaproxy01.net'],
  // Vercel's Image Optimization is metered and billed to the platform. Leaving
  // it on would charge us per transformation for optimisation nobody asked for.
  images: { unoptimized: true },
  experimental: {
    // Published apps are served through the RationalGo edge, so a server action
    // arrives carrying the user's host rather than the deployment's. Next
    // validates that origin and refuses the mismatch — without this every form
    // post on every published app fails with a bare 500.
    serverActions: { allowedOrigins: ['*.rationalgo.com'] },
  },
}

export default nextConfig
