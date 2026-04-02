/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  serverExternalPackages: ['pdf-parse'],

  // /super/* → /admin/*으로 영구 리디렉트
  async redirects() {
    return [
      { source: '/super/:path*', destination: '/admin/:path*', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
