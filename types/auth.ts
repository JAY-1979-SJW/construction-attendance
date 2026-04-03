export interface JwtPayload {
  sub: string       // workerId or adminId
  type: 'worker' | 'admin' | 'refresh'
  deviceToken?: string
  role?: string
  companyId?: string  // COMPANY_ADMIN / EXTERNAL_SITE_ADMIN — 업체 데이터 스코프 기준
  iat?: number
  exp?: number
}

export interface OtpRequest {
  phone: string
  purpose: 'LOGIN' | 'DEVICE_CHANGE'
}

export interface OtpVerifyRequest {
  phone: string
  code: string
  purpose: 'LOGIN' | 'DEVICE_CHANGE'
}

export interface LoginSession {
  workerId: string
  phone: string
  deviceToken: string
}
