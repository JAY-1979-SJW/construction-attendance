/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // /super/* → /admin/* 내용 서빙 (URL은 /super 유지)
  // /api/super/* → /api/admin/* 투명 프록시
  async rewrites() {
    return [
      { source: '/super/:path*', destination: '/admin/:path*' },
      { source: '/api/super/:path*', destination: '/api/admin/:path*' },
    ]
  },

  // /admin, /admin/login 접속 시 /super로 리다이렉트 (URL 정리)
  async redirects() {
    return [
      { source: '/admin', destination: '/super', permanent: false },
      { source: '/admin/login', destination: '/super/login', permanent: false },
    ]
  },
}

export default nextConfig
