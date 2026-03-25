import Anthropic from '@anthropic-ai/sdk'

export interface ParsedIdDocument {
  documentType: 'NATIONAL_ID' | 'DRIVER_LICENSE' | 'ALIEN_REGISTRATION' | 'UNKNOWN'
  name?: string
  birthDate?: string
  idNumber?: string
  nationality?: string
  address?: string
  issueDate?: string
  expiryDate?: string
  foreignerYn: boolean
  residentType?: 'DOMESTIC' | 'FOREIGNER' | 'OVERSEAS_KOREAN'
  licenseNumber?: string
  rawText?: string
  confidence: Record<string, number>
}

const SYSTEM_PROMPT = `당신은 한국 신분증 OCR 전문가입니다. 이미지에서 신분증 정보를 추출하여 JSON만 반환하세요.
형식: {"documentType":"NATIONAL_ID|DRIVER_LICENSE|ALIEN_REGISTRATION|UNKNOWN","name":"이름","birthDate":"YYYY-MM-DD","idNumber":"주민번호원문","nationality":"국적","address":"주소","issueDate":"YYYY-MM-DD","expiryDate":"YYYY-MM-DD","foreignerYn":false,"residentType":"DOMESTIC|FOREIGNER|OVERSEAS_KOREAN","licenseNumber":null,"rawText":"전체텍스트","confidence":{"name":0.9,"birthDate":0.9,"idNumber":0.9}}
규칙: 읽을 수 없으면 null. idNumber는 마스킹 없이 원문 반환. JSON만 반환.`

export const OCR_SKIPPED_MARKER = '__OCR_SKIPPED__'

export async function runOcr(imageBuffer: Buffer, mimeType: string): Promise<ParsedIdDocument> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.info('[OCR] key not configured — skipping OCR')
    return { documentType: 'UNKNOWN', foreignerYn: false, confidence: {}, rawText: OCR_SKIPPED_MARKER }
  }

  const client = new Anthropic({ apiKey })
  const base64 = imageBuffer.toString('base64')
  const mediaType = (mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg'

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: '이 신분증 이미지에서 정보를 추출해주세요.' },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 파싱 실패')
    const parsed = JSON.parse(jsonMatch[0]) as ParsedIdDocument
    return {
      ...parsed,
      foreignerYn: parsed.foreignerYn ?? false,
      confidence: parsed.confidence ?? {},
    }
  } catch (err) {
    console.error('[OCR] 실패:', err instanceof Error ? err.message : err)
    return { documentType: 'UNKNOWN', foreignerYn: false, confidence: {}, rawText: '[OCR 처리 실패]' }
  }
}
