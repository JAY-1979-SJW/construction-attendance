/**
 * lib/push/fcm.ts
 * Firebase Cloud Messaging (FCM Legacy HTTP API) 래퍼
 *
 * 환경변수:
 *   FCM_SERVER_KEY  — Firebase 프로젝트 서버 키 (필수, 미설정 시 발송 스킵)
 *
 * 반환: { success: boolean; error?: string }
 */

interface FcmPayload {
  to: string           // FCM registration token
  notification: {
    title: string
    body: string
  }
  data?: Record<string, string>   // 앱 딥링크 등 커스텀 데이터
  android?: { priority: 'high' | 'normal' }
  apns?: { headers: Record<string, string> }
}

export interface FcmResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendFcmPush(payload: FcmPayload): Promise<FcmResult> {
  const serverKey = process.env.FCM_SERVER_KEY
  if (!serverKey) {
    console.warn('[fcm] FCM_SERVER_KEY 미설정 — 푸시 발송 스킵')
    return { success: false, error: 'FCM_SERVER_KEY_NOT_SET' }
  }

  try {
    const body = JSON.stringify({
      to: payload.to,
      notification: payload.notification,
      data: payload.data ?? {},
      android: payload.android ?? { priority: 'high' },
      apns: payload.apns ?? { headers: { 'apns-priority': '10' } },
    })

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body,
    })

    const json = await res.json() as {
      success?: number; failure?: number; results?: { message_id?: string; error?: string }[]
    }

    if (!res.ok || json.success === 0) {
      const err = json.results?.[0]?.error ?? `HTTP ${res.status}`
      console.error('[fcm] 발송 실패', { error: err, token: payload.to.slice(-8) })
      return { success: false, error: err }
    }

    return { success: true, messageId: json.results?.[0]?.message_id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[fcm] 네트워크 오류', { error: msg })
    return { success: false, error: msg }
  }
}

/** 여러 토큰에 동시 발송 (최대 500건, FCM 권장 상한) */
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
