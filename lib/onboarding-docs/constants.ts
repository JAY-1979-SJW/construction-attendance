import type { OnboardingDocType, DocSubmitMethod } from '@prisma/client'

export const REQUIRED_DOC_TYPES: OnboardingDocType[] = [
  'CONTRACT',
  'PRIVACY_CONSENT',
  'HEALTH_DECLARATION',
  'HEALTH_CERTIFICATE',
  'SAFETY_ACK',
]

export const DOC_TYPE_LABELS: Record<OnboardingDocType, string> = {
  CONTRACT: '근로계약서',
  PRIVACY_CONSENT: '개인정보 제공 동의서',
  HEALTH_DECLARATION: '건강 이상 없음 각서',
  HEALTH_CERTIFICATE: '건강증명서',
  SAFETY_ACK: '안전서류 확인 및 서명',
}

export const DOC_TYPE_SUBMIT_METHOD: Record<OnboardingDocType, DocSubmitMethod> = {
  CONTRACT: 'SIGN',
  PRIVACY_CONSENT: 'SIGN',
  HEALTH_DECLARATION: 'SIGN',
  HEALTH_CERTIFICATE: 'UPLOAD',
  SAFETY_ACK: 'SIGN',
}
