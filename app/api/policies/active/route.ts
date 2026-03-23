import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

/**
 * GET /api/policies/active
 * 현재 활성 정책 문서 목록 조회 (공개 API — 인증 불필요)
 * 회원가입 화면에서 약관 내용 표시용
 */
export async function GET() {
  try {
    const docs = await prisma.policyDocument.findMany({
      where: { isActive: true, effectiveTo: null },
      select: {
        id: true,
        documentType: true,
        title: true,
        version: true,
        effectiveFrom: true,
        contentMd: true,
        isRequired: true,
      },
      orderBy: { documentType: 'asc' },
    })

    return NextResponse.json({ success: true, documents: docs })
  } catch (err) {
    console.error('[policies/active]', err)
    return NextResponse.json({ success: false, message: '조회 실패' }, { status: 500 })
  }
}
