import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { badRequest, internalError } from '@/lib/utils/response'
import { writeAuditLog } from '@/lib/audit/write-audit-log'
import { sendEmail } from '@/lib/email/send-email'
import { workerRegisteredEmail } from '@/lib/email/templates'

const schema = z.object({
  // 기본 정보
  name: z.string().min(2, '이름은 2자 이상 입력하세요.').max(30),
  phone: z.string().regex(/^010\d{8}$/, '올바른 휴대폰 번호를 입력하세요. (010XXXXXXXX)'),
  jobTitle: z.string().min(1, '직종을 입력하세요.').max(50),
  username: z.string().min(4, '아이디는 4자 이상 입력하세요.').max(30).optional(),
  email: z.string().email('올바른 이메일을 입력하세요.').optional(),
  birthDate: z.string().regex(/^\d{8}$/, '생년월일은 8자리 숫자로 입력하세요. (YYYYMMDD)').optional(),
  // 기기 정보
  deviceToken: z.string().min(10, '기기 토큰이 필요합니다.'),
  deviceName: z.string().min(1).max(100),
  // 동의 항목 (필수)
  consentTerms: z.boolean().refine(v => v, '서비스 이용약관에 동의해야 합니다.'),
  consentPrivacy: z.boolean().refine(v => v, '개인정보 수집·이용에 동의해야 합니다.'),
  consentLocation: z.boolean().refine(v => v, '위치정보 이용에 동의해야 합니다.'),
  consentMarketing: z.boolean().default(false),
  // 동의 문서 ID (선택 — 없으면 현재 활성 문서 자동 매핑)
  documentIds: z.record(z.string()).optional(), // { TERMS_OF_SERVICE: "pdoc_...", ... }
})

/**
 * POST /api/auth/register
 * 근로자 자가 회원가입.
 * 1. Worker 생성 (accountStatus = PENDING)
 * 2. 동의 이력 저장 (policyDocumentId + version)
 * 3. 기기 등록 요청 생성 (PENDING)
 *
 * 응답 status:
 *   ALREADY_REGISTERED — 이미 가입된 전화번호
 *   USERNAME_TAKEN     — 중복 아이디
 *   REGISTERED         — 가입 완료 (승인 대기)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.errors[0].message)

    const {
      name, phone, jobTitle, username, email, birthDate,
      deviceToken, deviceName,
      consentTerms, consentPrivacy, consentLocation, consentMarketing,
      documentIds,
    } = parsed.data

    // 1. 전화번호 중복 확인
    const existing = await prisma.worker.findUnique({ where: { phone } })
    if (existing) {
      return NextResponse.json({
        success: false,
        status: 'ALREADY_REGISTERED',
        message: '이미 가입된 휴대폰 번호입니다. 로그인 후 기기 등록을 요청하세요.',
      })
    }

    // 2. 아이디 중복 확인
    if (username) {
      const existingUsername = await prisma.worker.findUnique({ where: { username } })
      if (existingUsername) {
        return NextResponse.json({
          success: false,
          status: 'USERNAME_TAKEN',
          message: '이미 사용 중인 아이디입니다.',
        })
      }
    }

    // 3. 현재 활성 정책 문서 조회 (버전 참조용)
    const activeDocs = await prisma.policyDocument.findMany({
      where: { isActive: true, effectiveTo: null },
      select: { id: true, documentType: true, version: true },
    })
    const activeDocMap = Object.fromEntries(activeDocs.map(d => [d.documentType, d]))

    // 4. IP / User-Agent 수집
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null
    const userAgent = request.headers.get('user-agent') ?? null

    // 5. 트랜잭션: Worker + UserConsent + DeviceChangeRequest 생성
    const worker = await prisma.$transaction(async (tx) => {
      const w = await tx.worker.create({
        data: {
          name, phone, jobTitle,
          username: username ?? null,
          email: email ?? null,
          birthDate: birthDate ?? null,
          accountStatus: 'PENDING',
          isActive: true,
        },
      })

      // 동의 이력 저장 — 문서 버전 연결
      type ConsentType = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'LOCATION_POLICY' | 'MARKETING'
      type ConsentData = {
        workerId: string
        consentType: ConsentType
        policyDocumentId: string | null
        documentVersion: string
        isRequired: boolean
        agreed: boolean
        ipAddress: string | null
        userAgent: string | null
      }

      function makeConsent(type: ConsentType, agreed: boolean, required: boolean): ConsentData {
        const docKey = type === 'MARKETING' ? 'MARKETING_NOTICE' : type
        const doc = activeDocMap[docKey]
        const docId = documentIds?.[docKey] ?? doc?.id ?? null
        const docVersion = doc?.version ?? '1.0'
        return {
          workerId: w.id,
          consentType: type,
          policyDocumentId: docId,
          documentVersion: docVersion,
          isRequired: required,
          agreed,
          ipAddress,
          userAgent,
        }
      }

      const consents: ConsentData[] = [
        makeConsent('TERMS_OF_SERVICE', consentTerms, true),
        makeConsent('PRIVACY_POLICY', consentPrivacy, true),
        makeConsent('LOCATION_POLICY', consentLocation, true),
        makeConsent('MARKETING', consentMarketing, false),
      ]
      await tx.userConsent.createMany({ data: consents })

      // 기기 등록 요청 생성
      await tx.deviceChangeRequest.create({
        data: {
          workerId: w.id,
          oldDeviceToken: null,
          newDeviceToken: deviceToken,
          newDeviceName: deviceName,
          reason: '회원가입 최초 기기 등록',
          status: 'PENDING',
        },
      })

      return w
    })

    // 6. 감사 로그
    await writeAuditLog({
      actorUserId: worker.id,
      actorType: 'WORKER',
      actionType: 'USER_REGISTERED',
      targetType: 'Worker',
      targetId: worker.id,
      summary: `근로자 자가 회원가입 — ${name} (${phone})`,
      metadataJson: { phone, jobTitle, username, consentMarketing },
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    })

    // 접수 확인 이메일 (이메일 있는 경우)
    if (email) {
      const tpl = workerRegisteredEmail({ name })
      await sendEmail({ to: email, ...tpl })
    }

    return NextResponse.json({
      success: true,
      status: 'REGISTERED',
      data: { workerId: worker.id, name: worker.name },
      message: '회원가입이 완료되었습니다. 관리자 승인 후 사용 가능합니다.',
    })
  } catch (err) {
    console.error('[auth/register]', err)
    return internalError()
  }
}
