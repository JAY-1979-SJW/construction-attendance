export interface JwtPayload {
  sub: string       // workerId or adminId
  type: 'worker' | 'admin' | 'refresh'
  deviceToken?: string
  role?: string
  name?: string       // FOREMAN 스코프 판별용 (반장 본인 이름)
  companyId?: string  // COMPANY_ADMIN / EXTERNAL_SITE_ADMIN — 업체 데이터 스코프 기준
  teamName?: string   // TEAM_LEADER / FOREMAN — 담당 팀명
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
