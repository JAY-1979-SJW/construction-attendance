/**
 * Returns false only when running in local development (NODE_ENV=development).
 * Staging and production always get secure=true, even if NODE_ENV is not 'production'.
 */
export function isSecureCookieEnv(): boolean {
  return process.env.NODE_ENV !== 'development'
}
