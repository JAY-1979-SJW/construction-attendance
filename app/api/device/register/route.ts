import { NextResponse } from 'next/server'

/**
 * POST /api/device/register
 *
 * 관리자 승인형 전환으로 이 엔드포인트는 폐기되었습니다.
 * 기기 등록은 /api/auth/login → DeviceChangeRequest → 관리자 승인 흐름으로 처리됩니다.
 * 기기 변경은 /api/device/change-request 를 사용하세요.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        '이 엔드포인트는 사용 중단되었습니다. 기기 등록은 로그인 시 자동으로 처리됩니다.',
    },
    { status: 410 }
  )
}
