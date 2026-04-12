import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

function generateQrToken(): string {
  return randomBytes(32).toString('base64url')
}

async function main() {
  console.log('Seeding database...')

  // Admin
  const passwordHash = await bcrypt.hash(
    process.env.ADMIN_INITIAL_PASSWORD ?? 'admin1234',
    12
  )

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@haehan.com' },
    update: {},
    create: {
      name: '시스템 관리자',
      email: 'admin@haehan.com',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Admin created:', admin.email)

  // Sample Site
  const existingSite = await prisma.site.findFirst({ where: { name: '해한 1호 현장' } })
  const site = existingSite ?? await prisma.site.create({
    data: {
      name: '해한 1호 현장',
      address: '서울특별시 강남구 테헤란로 123',
      latitude: 37.5065,
      longitude: 127.0536,
      allowedRadius: 200,
      qrToken: generateQrToken(),
    },
  })
  console.log('Site:', site.name, '| QR URL: /qr/' + site.qrToken)

  // Sample Worker
  const worker = await prisma.worker.upsert({
    where: { phone: '01012345678' },
    update: {},
    create: {
      name: '홍길동',
      phone: '01012345678',
      jobTitle: '형틀목공',
    },
  })
  console.log('Worker created:', worker.name)

  // ── 앱 공통 문서 (ConsentDoc) 기본 데이터 ───────────────────────────
  const globalDocs = [
    {
      docType:   'PRIVACY_CONSENT' as const,
      scope:     'GLOBAL' as const,
      sortOrder: 1,
      title:     '개인정보 수집·이용 동의서 (v1)',
      contentMd: `## 개인정보 수집·이용 동의서

**수집 항목**: 성명, 생년월일, 연락처, 현장 출입 기록, 위치정보

**수집 목적**: 현장 출퇴근 관리, 안전 관리, 노무 행정 처리

**보유 기간**: 근로 관계 종료 후 3년

**제3자 제공**: 현장 원도급사, 발주처에 한해 노무 행정 목적으로 제공될 수 있습니다.

귀하는 본 동의를 거부할 권리가 있으나, 거부 시 현장 출역이 제한될 수 있습니다.

**위의 사항에 동의합니다.**`,
    },
    {
      docType:   'SAFETY_PLEDGE' as const,
      scope:     'GLOBAL' as const,
      sortOrder: 2,
      title:     '안전교육 서약서 (v1)',
      contentMd: `## 안전교육 서약서

본인은 현장 투입 전 안전교육을 이수하고, 아래 사항을 성실히 이행할 것을 서약합니다.

## 안전수칙

**1. 개인보호구 착용**: 안전모, 안전화, 안전조끼를 반드시 착용한다.

**2. 작업 전 안전 확인**: 작업 전 주변 위험 요소를 확인하고, 불안전한 상태에서 작업하지 않는다.

**3. 안전구역 준수**: 지정된 작업구역 내에서만 작업하며, 위험구역 출입을 금지한다.

**4. 신호수 지시 준수**: 장비 작업 시 신호수의 지시에 따른다.

**5. 음주·약물 금지**: 음주 또는 약물 복용 후 현장 출입을 금지한다.

**6. 사고 즉시 보고**: 사고 또는 아차사고 발생 시 즉시 현장 책임자에게 보고한다.

## 서약

본인은 위의 안전수칙을 충분히 숙지하였으며, 이를 성실히 이행할 것을 서약합니다.
위반 시 현장 출역 제한 등 불이익이 발생할 수 있음을 인지합니다.`,
    },
    {
      docType:   'GENERAL' as const,
      scope:     'GLOBAL' as const,
      sortOrder: 3,
      title:     '앱 이용 안내 및 동의서 (v1)',
      contentMd: `## 앱 이용 안내

본 앱(해한 출퇴근 관리)은 건설 현장 근로자의 출퇴근 기록 및 현장 안전 관리를 위해 제공됩니다.

## 주요 기능

**출퇴근 기록**: GPS 위치 확인을 통해 현장 출퇴근을 기록합니다.

**문서 관리**: 안전서류, 근로계약서 등 필수 문서를 모바일로 확인할 수 있습니다.

**알림**: 체류 확인, 현장 공지 등 중요 알림을 수신합니다.

## 이용 시 유의사항

- 본인 계정을 타인에게 양도하거나 공유하지 마십시오.
- 정확한 출퇴근 기록을 위해 위치 권한을 허용해 주십시오.
- 앱 관련 문의: 현장 관리자 또는 업체 담당자에게 연락하십시오.

**위의 내용을 확인하고 동의합니다.**`,
    },
  ]

  for (const doc of globalDocs) {
    const existing = await prisma.consentDoc.findFirst({
      where: { docType: doc.docType, scope: doc.scope, title: doc.title },
    })
    if (!existing) {
      await prisma.consentDoc.create({ data: doc })
      console.log(`ConsentDoc created: [${doc.docType}] ${doc.title}`)
    } else {
      console.log(`ConsentDoc already exists: [${doc.docType}] ${doc.title}`)
    }
  }

  console.log('\nSeeding complete!')
  console.log('Admin login: admin@haehan.com / admin1234 (or ADMIN_INITIAL_PASSWORD)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
