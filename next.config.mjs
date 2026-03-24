/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // /super/* → /admin/*으로 영구 리디렉트
  async redirects() {
    return [
      { source: '/super/:path*', destination: '/admin/:path*', permanent: true },
    ]
  },
}

export default nextConfig
