/**
 * 원청 하도급/외주 패키지 문서 템플릿
 * 건설산업기본법, 산업안전보건법, 하도급법 기준
 */

import type { ContractData, RenderedContract } from './templates'

// ─── 확장 데이터 타입 ─────────────────────────────────────────

export interface SubcontractData extends ContractData {
  // 수급인
  subcontractorBizNo:   string   // 사업자등록번호
  subcontractorName:    string   // 업체명
  subcontractorCeo:     string   // 대표자
  subcontractorAddr?:   string

  // 계약 내용
  scopeDescription:     string   // 공정/업무 범위
  contractAmount:       number   // 계약금액
  vatIncluded:          boolean  // VAT 포함 여부

  // 기성/정산
  paymentSchedule:      string   // 지급 방식 설명
  inspectionProcedure?: string   // 검수 절차

  // 장비/자재
  equipmentByContractor: boolean   // 수급인이 장비 부담
  materialByContractor:  boolean   // 수급인이 자재 부담
  equipmentNote?:        string

  // 안전
  safetyOfficerName?:   string    // 수급인 안전담당자
}

function won(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

// ─── B-1. 하도급·도급·용역계약서 본문 ────────────────────────

export function renderSubcontractBody(d: SubcontractData): RenderedContract {
  return {
    templateType: 'SUBCONTRACT_CONTRACT',
    title:        '하도급·도급·용역계약서',
    subtitle:     '(원청 직발주 기준)',
    legalBasis:   '민법, 건설산업기본법, 하도급거래 공정화에 관한 법률, 산업안전보건법',
    sections: [
      {
        title: '제1조 (계약 당사자)',
        content: `도급인(이하 "갑")
  - 상호: ${d.companyName}
  - 대표자: ${d.companyCeo}
  - 주소: ${d.companyAddress}

수급인(이하 "을")
  - 상호: ${d.subcontractorName}
  - 대표자: ${d.subcontractorCeo}
  - 사업자등록번호: ${d.subcontractorBizNo}
  - 주소: ${d.subcontractorAddr || '         '}`,
      },
      {
        title: '제2조 (계약 목적 및 공정 범위)',
        content: `① 현장명: ${d.siteName}
② 현장 주소: ${d.siteAddress || '         '}
③ 계약 공정·업무 범위: ${d.scopeDescription}
④ "을"은 위 공정·업무 범위를 독립적으로 수행하며, 계약 범위 외 업무는 별도 서면 합의 후 수행한다.
⑤ 세부 공정 범위는 [별첨 1: 공정범위 별첨]에 따른다.`,
      },
      {
        title: '제3조 (계약 기간)',
        content: `① 계약 시작일: ${d.startDate}
② 계약 종료일: ${d.endDate || '공정 완료 시까지'}
③ 공정 진행 상황에 따라 쌍방 합의로 기간을 변경할 수 있다.`,
      },
      {
        title: '제4조 (계약 금액 및 정산)',
        content: `① 계약 금액: ${won(d.contractAmount)} (VAT ${d.vatIncluded ? '포함' : '별도'})
② 지급 방식: ${d.paymentSchedule}
③ 기성 검수: ${d.inspectionProcedure || '"갑"의 현장관리자가 공정 확인 후 기성 승인'}
④ 세부 기성·정산 기준은 [별첨 2: 기성·정산 기준 별첨]에 따른다.
⑤ "을"이 제출하는 내부 인력배분 참고자료는 정산 참고 목적으로만 사용하며, "갑"이 각 개인에 대한 임금 지급의무를 직접 부담하는 근거가 되지 아니한다.`,
      },
      {
        title: '제5조 (수급인의 독립적 수행 및 인력 운영)',
        content: `① "을"은 자기 책임과 계산으로 인력, 장비, 작업방법을 정하여 계약 목적물을 수행한다.
② "을" 소속 인력의 채용, 배치, 근태 관리, 보수 지급, 세무 및 사회보험 관련 법정의무 이행은 원칙적으로 "을"의 책임으로 한다.
③ "갑"은 품질, 안전, 공정 및 결과물 확인 범위에서 협의·조정할 수 있으나, "을" 소속 인력에 대한 직접적인 인사·노무 지휘는 하지 않는다.
④ "을"은 소속 인력에 대한 적법한 고용관계 및 세무처리를 유지하여야 하며, 이를 위반하여 "갑"에게 손해가 발생한 경우 이를 배상한다.`,
      },
      {
        title: '제6조 (장비·자재 부담)',
        content: `① 작업 수행에 필요한 공구·장비: ${'을' + (d.equipmentByContractor ? '(수급인)' : '갑(도급인)')} 부담
② 주요 자재: ${'을' + (d.materialByContractor ? '(수급인)' : '갑(도급인)')} 부담
③ 세부 사항: ${d.equipmentNote || '[별첨 1]에 따른다'}`,
      },
      {
        title: '제7조 (안전·보건)',
        content: `① "을"은 산업안전보건법 등 관계 법령에 따른 안전보건 의무를 이행하여야 한다.
② "갑"과 "을"은 산업안전보건법 제75조에 따라 안전보건협의체를 구성하고 정기적으로 운영한다.
③ "갑"은 산업안전보건법 제64조에 따라 "을"의 작업을 주기적으로 순회점검하고 기록을 보관한다.
④ "갑"은 "을"의 근로자에 대한 안전보건교육을 지원하고 그 실시 여부를 확인한다.
⑤ "을"의 부주의로 인한 산업재해의 1차적 책임은 "을"이 부담하며, "갑"의 관리 소홀이 인정되는 부분에 대해서는 쌍방이 협의하여 처리한다.
⑥ 세부 안전보건 책임 및 협의 절차는 [별첨 3: 안전보건 책임 별첨]에 따른다.`,
      },
      {
        title: '제8조 (재하도급 제한)',
        content: `"을"은 "갑"의 서면 동의 없이 본 계약상 업무를 제3자에게 재위탁 또는 재하도급하지 못한다. 이를 위반할 경우 "갑"은 즉시 계약을 해지할 수 있다.`,
      },
      {
        title: '제9조 (제출서류)',
        content: `"을"은 계약 체결 후 [별첨 4: 제출서류 목록]에 명시된 서류를 "갑"에게 제출하여야 한다.
미제출 시 기성 지급이 유보될 수 있다.`,
      },
      {
        title: '제10조 (계약 해지)',
        content: `① 다음 각 호의 사유 발생 시 "갑"은 즉시 계약을 해지할 수 있다.
  1. 정당한 사유 없이 공정을 지연하거나 중단하는 경우
  2. 허위 자료를 제출하거나 부정한 방법으로 계약을 이행하는 경우
  3. 안전수칙을 중대하게 위반하여 사고 위험을 야기하는 경우
  4. 사업자등록 말소, 파산, 지급불능 등 계약 이행 불능 상태가 된 경우
② 해지 시 기성 정산은 실제 이행 부분에 대해 처리한다.`,
      },
    ],
    signatureBlock: `
위와 같이 계약을 체결하고 계약서를 2부 작성하여 각 1부씩 보관한다.

계약 체결일: ${d.contractDate}

도급인(갑)
  상호: ${d.companyName}
  대표자: ${d.companyCeo}   (서명 또는 인)

수급인(을)
  상호: ${d.subcontractorName}
  대표자: ${d.subcontractorCeo}   (서명 또는 인)
  사업자등록번호: ${d.subcontractorBizNo}
`,
  }
}

// ─── B-2. 공정범위 별첨 ───────────────────────────────────────

export interface ScopeAnnexData extends SubcontractData {
  scopeDetails: { section: string; description: string; unit?: string; qty?: number }[]
  exclusions?:  string[]
}

export function renderScopeAnnex(d: ScopeAnnexData): RenderedContract {
  const rows = d.scopeDetails.map((s, i) =>
    `  ${i + 1}. [${s.section}] ${s.description}${s.unit && s.qty ? ` — ${s.qty}${s.unit}` : ''}`
  ).join('\n')
  const excRows = d.exclusions?.map((e, i) => `  ${i + 1}. ${e}`).join('\n') || '  없음'

  return {
    templateType: 'SUBCONTRACT_SCOPE',
    title:        '[별첨 1] 공정범위 별첨',
    subtitle:     `${d.siteName} — ${d.subcontractorName}`,
    legalBasis:   '본 계약서 제2조 관련',
    sections: [
      {
        title: '수급인 수행 범위',
        content: rows || '  (항목 미입력)',
      },
      {
        title: '수급인 수행 제외 범위',
        content: excRows,
      },
      {
        title: '범위 해석 원칙',
        content: `위 범위에 명시되지 않은 사항이 공정 수행에 필요한 경우 "갑"과 "을"이 협의하여 처리한다.
임의로 범위를 확대하거나 축소하지 않으며, 이견 발생 시 계약서 제10조에 따른다.`,
      },
    ],
    signatureBlock: `
도급인 확인: ${d.companyName} ${d.companyCeo}   (서명 또는 인)
수급인 확인: ${d.subcontractorName} ${d.subcontractorCeo}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── B-3. 기성·정산 기준 별첨 ────────────────────────────────

export interface PaymentAnnexData extends SubcontractData {
  milestones:    { name: string; ratio: number; condition: string }[]
  paymentTerms:  string   // 검수 후 N일 이내 등
  retentionRate?: number  // 유보율 (%)
}

export function renderPaymentAnnex(d: PaymentAnnexData): RenderedContract {
  const rows = d.milestones.map((m, i) =>
    `  ${i + 1}. ${m.name} — ${m.ratio}% (${m.condition})`
  ).join('\n')
  const total = d.milestones.reduce((s, m) => s + m.ratio, 0)

  return {
    templateType: 'SUBCONTRACT_PAYMENT_TERMS',
    title:        '[별첨 2] 기성·정산 기준 별첨',
    subtitle:     `${d.siteName} — ${d.subcontractorName}`,
    legalBasis:   '본 계약서 제4조 관련',
    sections: [
      {
        title: '기성 지급 기준',
        content: `${rows || '  (기성 항목 미입력)'}
  ─────────────────
  합계: ${total}%`,
      },
      {
        title: '지급 조건',
        content: `지급 조건: ${d.paymentTerms}
유보율: ${d.retentionRate != null ? d.retentionRate + '% (공정 완료 후 지급)' : '없음'}`,
      },
      {
        title: '정산 절차',
        content: `① "을"은 기성 청구 시 기성내역서와 [별첨 4] 제출서류를 함께 제출한다.
② "갑"의 현장관리자가 공정 확인 후 검수서를 발행한다.
③ 검수 완료 후 위 지급 조건에 따라 대금을 지급한다.
④ 하자 또는 미시공 부분에 대해서는 시정 완료 확인 후 해당 기성을 지급한다.`,
      },
    ],
    signatureBlock: `
도급인 확인: ${d.companyName} ${d.companyCeo}   (서명 또는 인)
수급인 확인: ${d.subcontractorName} ${d.subcontractorCeo}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── B-4. 안전보건 책임 및 협의 절차 별첨 ────────────────────

export function renderSafetyProtocolAnnex(d: SubcontractData): RenderedContract {
  return {
    templateType: 'SUBCONTRACT_SAFETY_PROTOCOL',
    title:        '[별첨 3] 안전보건 책임 및 협의 절차 별첨',
    subtitle:     '(산업안전보건법 제64조·제75조 기준)',
    legalBasis:   '산업안전보건법 제64조, 제75조, 동법 시행규칙 제79조·제80조',
    sections: [
      {
        title: '안전보건 책임 분담',
        content: `[도급인 "갑" 책임]
  1. 현장 전체 안전보건관리 체계 수립 및 유지
  2. 안전보건협의체 구성 및 정기 운영 (월 1회 이상)
  3. "을"의 작업에 대한 주기적 순회점검 (주 1회 이상)
  4. "을"의 근로자 안전보건교육 실시 지원 및 결과 확인
  5. 위험작업 작업허가서 발행 기준 수립·관리

[수급인 "을" 책임]
  1. 소속 근로자에 대한 안전보건교육 실시 (신규채용·작업변경·특별교육)
  2. 개인보호구 지급 및 착용 지도
  3. 작업 전 TBM(Tool Box Meeting) 실시
  4. 위험요인 발견 즉시 "갑"에게 통보
  5. 산업재해 발생 즉시 "갑"에게 보고 및 공동 대응
  6. 소속 근로자에 대한 4대보험 등 법정의무 이행`,
      },
      {
        title: '안전보건협의체 운영',
        content: `① 구성: 도급인 안전담당자 + 수급인 대표 또는 안전담당자
② 운영 주기: 월 1회 이상 (산업안전보건법 시행규칙 제79조)
③ 협의 사항:
  - 작업의 시작 시간 및 작업 또는 작업장 간의 연락 방법
  - 재해 발생 위험 시 대피 방법
  - 작업장에서의 위험성평가 실시에 관한 사항
  - 사용하는 기계·기구·설비 또는 물질의 정보
  - 작업장에서 발생한 산업재해에 관한 사항
④ 회의록 작성·보관: 도급인이 작성하고 3년간 보관`,
      },
      {
        title: '순회점검 기준',
        content: `① 점검 주기: 주 1회 이상 (산업안전보건법 시행규칙 제80조)
② 점검 내용:
  - 안전모·안전화·안전대 등 보호구 착용 여부
  - 작업발판·안전난간 설치 상태
  - 추락방지망·개구부 덮개 설치 상태
  - 감전방지 조치 상태
  - 소화기 배치 및 화기작업 관리
  - 물질안전보건자료(MSDS) 게시 여부
③ 부적합 사항 발견 시: 즉시 수급인에게 시정 요청 및 기록 보관`,
      },
      {
        title: '위험작업 관리',
        content: `다음 작업은 도급인의 작업허가서 발행 후 실시한다.
  1. 고소작업 (2m 이상)
  2. 밀폐공간 작업
  3. 화기작업 (용접·절단·연마 등)
  4. 전기작업 (활선 또는 고압)
  5. 굴착 및 발파 작업
  6. 크레인·리프트 등 중장비 작업`,
      },
    ],
    signatureBlock: `
도급인 확인: ${d.companyName} ${d.companyCeo}   (서명 또는 인)
수급인 확인: ${d.subcontractorName} ${d.subcontractorCeo}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── B-5. 제출서류 목록 ───────────────────────────────────────

export function renderDocumentChecklist(d: SubcontractData): RenderedContract {
  return {
    templateType: 'SUBCONTRACT_DOCUMENT_LIST',
    title:        '[별첨 4] 수급인 제출서류 목록',
    subtitle:     `${d.siteName} — ${d.subcontractorName}`,
    legalBasis:   '본 계약서 제9조 관련',
    sections: [
      {
        title: '계약 체결 시 제출 (착공 전)',
        content: `□ 사업자등록증 사본
□ 법인등기부등본 또는 개인사업자 대표자 신분증 사본
□ 건설업 면허 또는 해당 업종 허가증 사본 (해당 시)
□ 산업재해보상보험 가입 증명서
□ 현장 안전관리계획서 또는 안전보건관리규정 (해당 시)
□ 소속 근로자 명단 (입력 시 업데이트)`,
      },
      {
        title: '기성 청구 시 제출 (매 기성)',
        content: `□ 기성내역서
□ 공정확인 사진 (착공 전·중·후)
□ 소속 근로자 출퇴근 기록 (참고용)
□ 안전보건교육 실시 기록 (신규·변경 교육)
□ 내부 인력배분 참고자료 (정산 참고용 — 임금 직접지급 근거 아님)`,
      },
      {
        title: '준공 시 제출',
        content: `□ 준공 사진
□ 시공 확인서
□ 하자 보수 이행각서 (해당 시)
□ 정산확인서`,
      },
      {
        title: '안내',
        content: `서류 미제출 시 해당 기성 지급이 유보될 수 있습니다.
원청은 위 서류를 계약 종료 후 5년간 보관합니다.`,
      },
    ],
    signatureBlock: `
도급인 수령 확인: ___________   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── B-6. 내부 배분 참고자료 양식 ────────────────────────────

export function renderDistributionReference(d: SubcontractData): RenderedContract {
  return {
    templateType: 'SUBCONTRACT_DISTRIBUTION_REF',
    title:        '[내부 참고] 인력배분 참고자료',
    subtitle:     '⚠ 본 자료는 정산 참고 목적 전용 — 임금 직접지급 근거 아님',
    legalBasis:   '본 계약서 제4조 제5항 관련',
    sections: [
      {
        title: '주의사항 (필독)',
        content: `본 자료는 수급인이 기성 정산 참고를 위해 제출하는 내부 배분 참고자료입니다.

⚠ 다음 사항을 반드시 확인하십시오:
① 본 자료는 도급인(원청)이 각 개인에 대한 임금 지급의무를 직접 부담하는 근거가 아닙니다.
② 원청이 본 자료를 기준으로 개인에게 직접 송금하는 행위는 직접고용 또는 파견 논점을 발생시킬 수 있습니다.
③ 개인별 금액 및 지급은 수급인의 책임입니다.
④ 원청은 본 자료를 내부 기성 검증 목적으로만 활용하고 외부에 공개하지 않습니다.`,
      },
      {
        title: '배분 내역 (수급인 작성)',
        content: `수급인: ${d.subcontractorName}
기성 대상 기간: ___________
기성 총액: ___________

  번호 | 성명 | 작업 기간 | 공수 | 배분 금액 | 비고
  ─────────────────────────────────────────────
  1.   |      |           |      |           |
  2.   |      |           |      |           |
  3.   |      |           |      |           |
  (필요 시 추가)
  ─────────────────────────────────────────────
  합계 |      |           |      |           |`,
      },
    ],
    signatureBlock: `
수급인 대표: ${d.subcontractorCeo}   (서명 또는 인)
제출 일자: ___________
`,
  }
}
