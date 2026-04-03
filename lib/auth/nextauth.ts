import NextAuth from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers'
import Kakao from 'next-auth/providers/kakao'

/**
 * Google을 type:'oauth'로 정의하여 OIDC iss 검증(oauth4webapi v3)을 우회.
 * next-auth v5 beta.30 + oauth4webapi 3.x에서 Google authorization response에
 * iss 파라미터가 누락되어 CallbackRouteError 발생하는 문제 해결.
 */
const GoogleOAuth: OAuthConfig<{
  sub: string; name: string; email: string; picture?: string
}> = {
  id: 'google',
  name: 'Google',
  type: 'oauth',
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    url: 'https://accounts.google.com/o/oauth2/v2/auth',
    params: { scope: 'openid email profile' },
  },
  token: { url: 'https://oauth2.googleapis.com/token' },
  userinfo: { url: 'https://openidconnect.googleapis.com/v1/userinfo' },
  checks: ['state'],
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    }
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GoogleOAuth,
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
      checks: ['state'],
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async redirect({ baseUrl }) {
      return `${baseUrl}/api/auth/complete`
    },
  },
})
