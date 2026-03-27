/**
 * 투입 전 필수 문서 템플릿 시드
 *
 * 실행: npx tsx scripts/seed-onboarding-templates.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const templates = [
  {
    docType: 'PRIVACY_CONSENT' as const,
    title: '개인정보 수집·이용 동의서',
    contentHtml: `
      <h2>개인정보 수집·이용 동의서</h2>
      <h3>1. 수집 항목</h3>
      <p>성명, 생년월일, 연락처(휴대폰), 주민등록번호(뒷자리), 주소, 계좌정보(은행명/계좌번호)</p>
      <h3>2. 수집·이용 목적</h3>
      <ul>
        <li>근로계약 체결 및 이행</li>
        <li>4대보험 신고 및 관리</li>
        <li>급여 지급 및 세무 신고</li>
        <li>출퇴근 관리 및 현장 안전 관리</li>
      </ul>
      <h3>3. 보유 및 이용 기간</h3>
      <p>고용관계 종료 후 3년 (근로기준법 제42조)</p>
      <h3>4. 동의 거부 권리</h3>
      <p>동의를 거부할 권리가 있으며, 거부 시 근로계약 체결이 제한될 수 있습니다.</p>
    `,
    versionNo: 1,
  },
  {
    docType: 'HEALTH_DECLARATION' as const,
    title: '건강 이상 없음 각서',
    contentHtml: `
      <h2>건강 이상 없음 각서</h2>
      <p>본인은 현재 건설현장 근로에 지장을 줄 수 있는 건강상의 이상이 없음을 확인합니다.</p>
      <h3>확인 사항</h3>
      <ul>
        <li>고혈압, 당뇨, 심장질환, 간질 등 중대한 질환이 없습니다.</li>
        <li>고소작업, 중량물 취급 등에 제한이 되는 건강상 문제가 없습니다.</li>
        <li>위 사항에 해당하는 질환이 있는 경우 사전에 고지하였습니다.</li>
      </ul>
      <p><strong>미고지로 인한 사고 발생 시 본인에게 책임이 있음을 확인합니다.</strong></p>
    `,
    versionNo: 1,
  },
  {
    docType: 'HEALTH_CERTIFICATE' as const,
    title: '건강증명서',
    contentHtml: `
      <h2>건강증명서 제출 안내</h2>
      <p>건강증명서(일반건강진단서)를 사진 또는 스캔본으로 업로드해 주세요.</p>
      <h3>유의사항</h3>
      <ul>
        <li>최근 6개월 이내 발급된 건강증명서만 유효합니다.</li>
        <li>의료기관 명칭, 검진일, 판정 결과가 식별 가능해야 합니다.</li>
        <li>파일 형식: JPG, PNG, PDF (최대 10MB)</li>
      </ul>
    `,
    versionNo: 1,
  },
  {
    docType: 'SAFETY_ACK' as const,
    title: '안전서류 확인 및 서명',
    contentHtml: `
      <h2>안전수칙 준수 서약서</h2>
      <p>본인은 아래 안전수칙을 숙지하고 준수할 것을 서약합니다.</p>
      <h3>안전수칙</h3>
      <ol>
        <li>안전보호구(안전모, 안전화, 안전벨트 등)를 반드시 착용합니다.</li>
        <li>안전교육에 성실히 참여하고 교육 내용을 현장에서 실천합니다.</li>
        <li>위험 상황 발견 시 즉시 작업을 중단하고 관리자에게 보고합니다.</li>
        <li>음주 상태에서의 작업을 절대 하지 않습니다.</li>
        <li>허가 없이 지정 작업구역 이외의 장소에 출입하지 않습니다.</li>
        <li>작업 전 안전점검을 실시하고 이상 발견 시 보고합니다.</li>
        <li>비상 대피 경로를 숙지하고 비상 시 신속히 대피합니다.</li>
      </ol>
      <p><strong>위 사항을 위반하여 발생하는 사고에 대해 본인도 책임이 있음을 확인합니다.</strong></p>
    `,
    versionNo: 1,
  },
]

async function main() {
  console.log('=== 온보딩 문서 템플릿 시드 시작 ===')

  for (const t of templates) {
    const existing = await prisma.onboardingDocTemplate.findFirst({
      where: { docType: t.docType, isActive: true },
    })

    if (existing) {
      console.log(`  스킵 (이미 존재): ${t.docType}`)
      continue
    }

    await prisma.onboardingDocTemplate.create({
      data: {
        docType: t.docType,
        title: t.title,
        contentHtml: t.contentHtml,
        versionNo: t.versionNo,
        isActive: true,
      },
    })
    console.log(`  생성: ${t.docType} - ${t.title}`)
  }

  console.log('=== 완료 ===')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
