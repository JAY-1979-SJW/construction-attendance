/**
 * OAuth 회원가입 프로필 완성 API
 * worker_token 쿠키가 있는 상태에서 이름·전화·직종 업데이트
 */
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getWorkerSession } from '@/lib/auth/guards'
import { ok, badRequest, unauthorized, conflict } from '@/lib/utils/response'

const RegisterSchema = z.object({
  name:     z.string().min(2, '이름은 2자 이상').max(30),
  phone:    z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요'),
  jobTitle: z.string().min(1, '직종을 입력하세요').max(50),
})

export async function POST(req: NextRequest) {
  const session = await getWorkerSession()
  if (!session) return unauthorized('로그인이 필요합니다.')

  const body = await req.json().catch(() => null)
  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.errors[0].message)

  const { name, phone, jobTitle } = parsed.data

  // 전화번호 중복 확인
  const phoneExists = await prisma.worker.findFirst({
    where: { phone, id: { not: session.sub } },
    select: { id: true },
  })
  if (phoneExists) return conflict('이미 등록된 전화번호입니다.')

  await prisma.worker.update({
    where: { id: session.sub },
    data: { name, phone, jobTitle },
  })

  return ok({ id: session.sub, name, phone, jobTitle })
}
