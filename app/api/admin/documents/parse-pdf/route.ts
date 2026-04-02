/**
 * POST /api/admin/documents/parse-pdf
 *
 * PDF 파일 업로드 → 텍스트 추출 → 계약서 필드 구조화 추출
 *
 * Request: multipart/form-data { file: PDF }
 * Response: { fields, pages, textLength }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/guards'
import { unauthorized } from '@/lib/utils/response'
import { parsePdfContract, extractTextFromPdf } from '@/lib/pdf/pdf-parse-service'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF 파일만 지원합니다.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하만 지원합니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const mode = formData.get('mode') as string | null

  try {
    // mode=text : 텍스트 추출만 (OpenAI API 호출 안 함)
    if (mode === 'text') {
      const { text, pages, info } = await extractTextFromPdf(buffer)
      return NextResponse.json({ text, pages, info, textLength: text.length })
    }

    // 기본: 텍스트 추출 + OpenAI 구조화 파싱 (실패 시 Vision fallback)
    const result = await parsePdfContract(buffer)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[parse-pdf] 처리 오류:', (err as Error).message)
    return NextResponse.json(
      { error: 'PDF 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    )
  }
}
