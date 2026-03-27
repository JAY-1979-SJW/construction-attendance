import { NextRequest } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { prisma } from '@/lib/db/prisma'
import { ok, unauthorized, internalError } from '@/lib/utils/response'

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.replace(/\D/g, '') ?? ''
    const name = searchParams.get('name')?.trim() ?? ''
    const birthDate = searchParams.get('birthDate') ?? ''

    const warnings: string[] = []

    // 전화번호 중복
    if (phone && /^010\d{8}$/.test(phone)) {
      const byPhone = await prisma.worker.findUnique({
        where: { phone },
        select: { id: true, name: true, phone: true },
      })
      if (byPhone) {
        warnings.push(`동일 전화번호 근로자 존재: ${byPhone.name} (${byPhone.phone})`)
      }
    }

    // 이름+생년월일 유사 중복
    if (name && birthDate && /^\d{8}$/.test(birthDate)) {
      const byNameBirth = await prisma.worker.findFirst({
        where: { name, birthDate },
        select: { id: true, name: true, phone: true },
      })
      if (byNameBirth) {
        warnings.push(`동일 이름+생년월일 근로자 존재: ${byNameBirth.name} (${byNameBirth.phone ?? '번호없음'})`)
      }
    }

    return ok({ warnings })
  } catch (err) {
    console.error('[check-duplicate]', err)
    return internalError()
  }
}
