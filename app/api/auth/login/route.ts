import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { badRequest, internalError } from '@/lib/utils/response'

const schema = z.object({
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요.'),
  deviceToken: z.string().min(10),
  deviceName: z.string().min(1).max(100),
})

/**
 * POST /api/auth/login
 * 관리자 승인형 로그인.
 * OTP 없이 phone + deviceToken으로 근로자 상태를 확인하고 JWT를 발급합니다.
 *
 * 응답 status 값:
 *   NOT_REGISTERED  — 미등록 번호
 *   INACTIVE        — 비활성 계정
 *   DEVICE_APPROVED — 승인된 기기, JWT 발급 (worker_token 쿠키 세팅)
 *   DEVICE_PENDING  — 기기 승인 대기 중
 *   DEVICE_REJECTED — 기기 반려됨
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const { phone, deviceToken, deviceName } = parsed.data

    // 1. 근로자 조회
    const worker = await prisma.worker.findUnique({ where: { phone } })
    if (!worker) {
      return NextResponse.json({
        success: false,
        status: 'NOT_REGISTERED',
        message: '등록되지 않은 근로자입니다. 관리자에게 문의하세요.',
      })
    }

    // 2. 활성 여부 확인
    if (!worker.isActive) {
      return NextResponse.json({
        success: false,
        status: 'INACTIVE',
        message: '사용이 중지된 계정입니다. 관리자에게 문의하세요.',
      })
    }

    // 3. 이미 승인된 기기인지 확인
    const approvedDevice = await prisma.workerDevice.findFirst({
      where: { workerId: worker.id, deviceToken, isActive: true },
    })

    if (approvedDevice) {
      await prisma.workerDevice.update({
        where: { id: approvedDevice.id },
        data: { lastLoginAt: new Date() },
      })

      const token = await signToken({
        sub: worker.id,
        type: 'worker',
        deviceToken,
      })

      const response = NextResponse.json({
        success: true,
        status: 'DEVICE_APPROVED',
        data: { workerName: worker.name, workerId: worker.id },
        message: '로그인되었습니다.',
      })

      response.cookies.set('worker_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/',
      })

      return response
    }

    // 4. 이 기기에 대한 기존 요청 확인 (가장 최근 것)
    const existingRequest = await prisma.deviceChangeRequest.findFirst({
      where: { workerId: worker.id, newDeviceToken: deviceToken },
      orderBy: { requestedAt: 'desc' },
    })

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json({
          success: false,
          status: 'DEVICE_PENDING',
          message: '기기 승인 대기 중입니다. 관리자 승인 후 사용 가능합니다.',
        })
      }
      if (existingRequest.status === 'REJECTED') {
        return NextResponse.json({
          success: false,
          status: 'DEVICE_REJECTED',
          message: '기기 등록이 반려되었습니다. 관리자에게 문의하세요.',
        })
      }
      // APPROVED이지만 WorkerDevice가 없는 엣지케이스: 요청만 재접수
    }

    // 5. 신규 기기 — 등록 요청 생성 (PENDING)
    await prisma.deviceChangeRequest.create({
      data: {
        workerId: worker.id,
        oldDeviceToken: null,
        newDeviceToken: deviceToken,
        newDeviceName: deviceName,
        reason: existingRequest?.status === 'APPROVED' ? '기기 재등록 요청' : '최초 기기 등록',
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: false,
      status: 'DEVICE_PENDING',
      message: '기기 등록 요청이 접수되었습니다. 관리자 승인 후 사용 가능합니다.',
    })
  } catch (err) {
    console.error('[auth/login]', err)
    return internalError()
  }
}
