/**
 * PDF 파싱 서비스
 *
 * 1단계: pdf-parse 로 PDF 버퍼 → 텍스트 추출
 * 2단계: OpenAI API 로 텍스트 → 구조화 데이터 추출 (계약서 필드)
 *
 * 사용 위치:
 *   - api/admin/documents/parse-pdf/route.ts
 */
import OpenAI from 'openai'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

// ─── 타입 ───────────────────────────────────────────────────────────────────

export interface PdfTextResult {
  text: string
  pages: number
  info: Record<string, unknown>
}

export interface ParsedContractFields {
  companyName?: string
  companyBizNo?: string
  companyCeo?: string
  companyAddress?: string
  workerName?: string
  workerBirthDate?: string
  workerPhone?: string
  workerAddress?: string
  siteName?: string
  siteAddress?: string
  jobTitle?: string
  startDate?: string
  endDate?: string
  dailyWage?: number
  monthlySalary?: number
  paymentDay?: number
  checkInTime?: string
  checkOutTime?: string
  breakHours?: number
  contractType?: string
  specialTerms?: string
  rawText?: string
  confidence: Record<string, number>
}

// ─── 1단계: PDF → 텍스트 ─────────────────────────────────────────────────────

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfTextResult> {
  const result = await pdfParse(buffer)
  return {
    text: result.text as string,
    pages: result.numpages as number,
    info: (result.info ?? {}) as Record<string, unknown>,
  }
}

// ─── 2단계: 텍스트 → 구조화 추출 (OpenAI API) ───────────────────────────────

const SYSTEM_PROMPT = `당신은 한국 건설현장 근로계약서 분석 전문가입니다.
PDF에서 추출된 텍스트를 받아 계약서 필드를 JSON으로 반환하세요.

반환 형식:
{
  "companyName": "사업주/업체명",
  "companyBizNo": "사업자등록번호",
  "companyCeo": "대표자명",
  "companyAddress": "사업장 주소",
  "workerName": "근로자명",
  "workerBirthDate": "YYYY-MM-DD",
  "workerPhone": "연락처",
  "workerAddress": "근로자 주소",
  "siteName": "현장명/공사명",
  "siteAddress": "현장 주소",
  "jobTitle": "직종/업무내용",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "dailyWage": 숫자(원),
  "monthlySalary": 숫자(원),
  "paymentDay": 매월 지급일(숫자),
  "checkInTime": "HH:MM",
  "checkOutTime": "HH:MM",
  "breakHours": 숫자(시간),
  "contractType": "DAILY|REGULAR|FIXED_TERM|SUBCONTRACT|FREELANCER",
  "specialTerms": "특약사항 원문",
  "confidence": { "필드명": 0.0~1.0 }
}

규칙:
- 텍스트에서 확인할 수 없는 필드는 null 반환
- 날짜는 반드시 YYYY-MM-DD 형식
- 금액은 숫자만 (쉼표/원 제거)
- confidence 는 각 필드의 추출 확신도 (0.0~1.0)
- JSON만 반환, 설명 불필요`

export async function parseContractFields(text: string): Promise<ParsedContractFields> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { rawText: text, confidence: {}, contractType: undefined }
  }

  const client = new OpenAI({ apiKey })

  // 토큰 절약: 텍스트가 너무 길면 앞뒤 8000자만 사용
  const maxLen = 16000
  const truncated = text.length > maxLen
    ? text.slice(0, maxLen / 2) + '\n...(중략)...\n' + text.slice(-maxLen / 2)
    : text

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `다음은 근로계약서 PDF에서 추출된 텍스트입니다. 구조화된 JSON으로 변환해주세요.\n\n${truncated}`,
      },
    ],
  })

  const responseText = response.choices[0]?.message?.content ?? ''
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { rawText: text, confidence: {}, contractType: undefined }
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedContractFields
  return { ...parsed, rawText: text, confidence: parsed.confidence ?? {} }
}

// ─── 통합: PDF 버퍼 → 구조화 데이터 ──────────────────────────────────────────

export async function parsePdfContract(buffer: Buffer): Promise<{
  fields: ParsedContractFields
  pages: number
  textLength: number
}> {
  const { text, pages } = await extractTextFromPdf(buffer)

  if (!text || text.trim().length === 0) {
    return {
      fields: { rawText: '', confidence: {}, contractType: undefined },
      pages,
      textLength: 0,
    }
  }

  const fields = await parseContractFields(text)
  return { fields, pages, textLength: text.length }
}
