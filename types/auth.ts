export interface JwtPayload {
  sub: string       // workerId or adminId
  type: 'worker' | 'admin'
  deviceToken?: string
  role?: string
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
