/**
 * lib/push/fcm.ts
 * Firebase Cloud Messaging — Firebase Admin SDK 기반 구현
 *
 * 인증 방식 (우선순위 순):
 *   1. GOOGLE_APPLICATION_CREDENTIALS 환경변수
 *      — 서비스 계정 JSON 파일의 절대 경로를 지정
 *      — 예: /secrets/firebase-service-account.json
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON 환경변수
 *      — 서비스 계정 JSON 전체를 문자열로 직접 주입 (Kubernetes Secret 등)
 *   3. GCP 환경 내 Application Default Credentials (ADC)
 *      — GCE/Cloud Run 등 GCP 관리형 환경에서 자동 적용
 *
 * 어느 쪽도 없으면 초기화 실패 → 발송 스킵 (warn 로그)
 *
 * 환경변수:
 *   GOOGLE_APPLICATION_CREDENTIALS  — 서비스 계정 JSON 파일 경로 (권장)
 *   FIREBASE_SERVICE_ACCOUNT_JSON   — 서비스 계정 JSON 문자열 (대안)
 *
 * 반환: { success: boolean; messageId?: string; error?: string }
 */

import * as admin from 'firebase-admin'

// ── 앱 초기화 (모듈 로드 시 1회) ────────────────────────────────────────────

function initializeApp(): admin.app.App | null {
  // 이미 초기화된 앱 재사용
  if (admin.apps.length > 0) return admin.apps[0]!

  try {
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

    if (jsonEnv) {
      // 환경변수에 JSON 문자열로 직접 주입된 경우
      const serviceAccount = JSON.parse(jsonEnv) as admin.ServiceAccount
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }

    // GOOGLE_APPLICATION_CREDENTIALS 파일 경로 또는 ADC (GCP 환경)
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[fcm] Firebase Admin SDK 초기화 실패 — 푸시 발송 불가', { error: msg })
    return null
  }
}

const firebaseApp = initializeApp()

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface FcmResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface FcmPayload {
  /** FCM 등록 토큰 (단일 기기) */
  to: string
  notification: {
    title: string
    body: string
  }
  /** 앱 딥링크 등 커스텀 데이터 (string 값만 허용) */
  data?: Record<string, string>
  android?: { priority: 'high' | 'normal' }
  apns?: { headers: Record<string, string> }
}

// ── 단건 발송 ─────────────────────────────────────────────────────────────────

export async function sendFcmPush(payload: FcmPayload): Promise<FcmResult> {
  if (!firebaseApp) {
    console.warn('[fcm] Firebase Admin SDK 미초기화 — 푸시 발송 스킵')
    return { success: false, error: 'FIREBASE_NOT_INITIALIZED' }
  }

  try {
    const message: admin.messaging.Message = {
      token: payload.to,
      notification: {
        title: payload.notification.title,
        body:  payload.notification.body,
      },
      data: payload.data ?? {},
      android: {
        priority: payload.android?.priority ?? 'high',
      },
      apns: {
        headers: payload.apns?.headers ?? { 'apns-priority': '10' },
      },
    }

    const messageId = await admin.messaging(firebaseApp).send(message)
    return { success: true, messageId }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    // 무효 토큰 구분 로깅 (토큰 정리 로직 연계용)
    const isInvalidToken = msg.includes('registration-token-not-registered')
      || msg.includes('invalid-registration-token')
    console.error('[fcm] 발송 실패', {
      error:           msg,
      invalidToken:    isInvalidToken,
      tokenSuffix:     payload.to.slice(-8),
    })

    return { success: false, error: msg }
  }
}

// ── 멀티캐스트 (여러 토큰 동시 발송, 최대 500건 권장) ─────────────────────────

export async function sendFcmMulticast(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    tokens.map((to) => sendFcmPush({ to, notification, data })),
  )
  let sent = 0; let failed = 0
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) sent++
    else failed++
  }
  return { sent, failed }
}
