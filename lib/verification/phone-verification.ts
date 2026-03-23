/**
 * 휴대폰 본인확인 서비스 인터페이스
 *
 * 현재 정책: 외부기관 본인확인 미사용 (NoopPhoneVerificationService)
 * 추후 NICE아이디 / KMC(한국모바일인증) / KG모빌리언스 등 도입 시
 * 아래 인터페이스를 구현한 클래스로 교체하면 됩니다.
 *
 * 참고: KISA 본인확인 지원포털(aid.kisa.or.kr)에서 국내 본인확인기관 목록 확인 가능
 */

export interface PhoneVerificationRequest {
  workerId: string
  phone: string
  callbackUrl: string  // 본인확인 완료 후 리다이렉트 URL
}

export interface PhoneVerificationResult {
  success: boolean
  transactionId?: string
  ci?: string  // 연계정보 (Connected Information)
  di?: string  // 중복가입확인정보 (Duplication Information)
  verifiedPhone?: string
  errorCode?: string
  message?: string
}

/**
 * 본인확인 서비스 인터페이스
 * 현재는 NoopPhoneVerificationService로 구현
 * 실제 연동 시: NicePhoneVerificationService 등으로 교체
 */
export interface IPhoneVerificationService {
  /** 본인확인 요청 URL 생성 */
  initiateVerification(req: PhoneVerificationRequest): Promise<string>
  /** 본인확인 결과 처리 */
  processCallback(params: Record<string, string>): Promise<PhoneVerificationResult>
  /** 현재 서비스 사용 가능 여부 */
  isEnabled(): boolean
}

/**
 * NoopPhoneVerificationService
 * 현재 단계: 외부기관 본인확인 미사용
 * 기기승인 + GPS + 사진촬영으로 대체
 */
export class NoopPhoneVerificationService implements IPhoneVerificationService {
  isEnabled(): boolean {
    return false
  }

  async initiateVerification(_req: PhoneVerificationRequest): Promise<string> {
    throw new Error('PhoneVerification is not enabled. Current policy: device approval + GPS + photo evidence.')
  }

  async processCallback(_params: Record<string, string>): Promise<PhoneVerificationResult> {
    return {
      success: false,
      errorCode: 'NOT_IMPLEMENTED',
      message: '휴대폰 본인확인 서비스가 활성화되지 않았습니다.',
    }
  }
}

/**
 * 현재 활성 본인확인 서비스 인스턴스
 * feature flag(PHONE_VERIFICATION_PROVIDER 환경변수)로 교체 가능
 */
export function getPhoneVerificationService(): IPhoneVerificationService {
  const provider = process.env.PHONE_VERIFICATION_PROVIDER

  // 추후: provider === 'NICE' → return new NicePhoneVerificationService()
  // 추후: provider === 'KMC'  → return new KmcPhoneVerificationService()
  // 추후: provider === 'KG'   → return new KgPhoneVerificationService()

  if (provider && provider !== 'NONE') {
    console.warn(`[PhoneVerification] Unknown provider: ${provider}. Falling back to Noop.`)
  }

  return new NoopPhoneVerificationService()
}
