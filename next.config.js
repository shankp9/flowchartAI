/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false, // Should be false for production quality
  },
  images: {
    unoptimized: true, // Consider optimizing if you serve many images not via CDN
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true, // ETag generation can be useful for caching
  reactStrictMode: true, // Enforce React Strict Mode

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security", // Enforce HTTPS
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy", // Restrict browser features
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Basic CSP - adjust as needed for your specific scripts, styles, and resources
          // {
          //   key: 'Content-Security-Policy',
          //   value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://assets.vercel.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none';",
          // },
        ],
      },
    ]
  },
}

module.exports = nextConfig
