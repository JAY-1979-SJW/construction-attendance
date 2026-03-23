/**
 * 안전보건 문서 템플릿
 * 산업안전보건법, 시행규칙 별표 5 기준
 */

import type { ContractData, RenderedContract } from './templates'

// ─── 1. 신규채용 안전보건교육 확인서 ──────────────────────────

export interface SafetyEducationData extends ContractData {
  educationDate:   string
  educationHours:  number       // 법정: 일용 1시간↑, 신규채용 8시간↑
  educationPlace:  string
  educatorName:    string
  educatorPosition?: string
}

const NEW_HIRE_EDUCATION_CONTENTS = [
  '1. 산업안전 및 사고 예방에 관한 사항',
  '2. 산업보건 및 직업병 예방에 관한 사항',
  '3. 위험성평가에 관한 사항',
  '4. 산업안전보건 법령 및 산업재해보상보험 제도의 개요',
  '5. 표준안전작업방법 및 안전보건수칙에 관한 사항',
  '6. 전기·기계·기구의 위험성과 작업 시 주의사항',
  '7. 물질안전보건자료(MSDS)에 관한 사항',
  '8. 직무스트레스 예방 및 관리에 관한 사항',
  '9. 직장 내 괴롭힘, 고객의 폭언 등으로 인한 건강장해 예방에 관한 사항',
  '10. 추락·낙하·붕괴·감전·화재 등 건설 현장 주요 위험요인 및 예방',
  '11. 개인보호구 착용 방법 및 관리에 관한 사항',
  '12. 작업 중지 및 대피 요령에 관한 사항',
]

export function renderSafetyEducationNewHire(d: SafetyEducationData): RenderedContract {
  return {
    templateType: 'SAFETY_EDUCATION_NEW_HIRE',
    title:        '안전보건교육 확인서',
    subtitle:     '(산업안전보건법 제29조·시행규칙 제26조·별표 5 기준)',
    legalBasis:   '산업안전보건법 제29조, 동법 시행규칙 제26조, 별표 5',
    sections: [
      {
        title: '교육 개요',
        content: `교육 일시:    ${d.educationDate}
교육 장소:    ${d.educationPlace || d.siteName}
교육 시간:    ${d.educationHours}시간
교육 실시자:  ${d.educatorName}${d.educatorPosition ? ` (${d.educatorPosition})` : ''}
근로자 성명:  ${d.workerName}
직종:         ${d.jobTitle}
현장명:       ${d.siteName}`,
      },
      {
        title: '1. 기본 보호구 착용 의무',
        content: `근로자는 작업 중 다음 보호구를 착용하여야 한다.
- 안전모 (모든 작업 시)
- 안전화 (모든 작업 시)
- 안전조끼 (모든 작업 시)
- 작업장갑 (작업유형에 따라)
- 작업유형에 따른 추가 보호구 (보안경, 안전대, 방진마스크, 귀마개, 각반 등)`,
      },
      {
        title: '2. 주요 위험요인 안내',
        content: `다음 위험요인에 유의하여야 한다.
- 추락 위험: 고소작업 시 안전대 착용 및 난간 설치 확인
- 낙하물 위험: 안전모 착용 및 위험구역 출입 제한
- 감전 위험: 전기작업 시 전원 차단 및 절연장갑 착용
- 비산물 위험: 절단·연마 작업 시 보안경 착용
- 협착 및 절단 위험: 회전체 및 날카로운 기구 주의
- 전동공구 사용 위험: 사용 전 점검 및 올바른 사용 방법 준수`,
      },
      {
        title: '3. 작업 전 확인사항',
        content: `작업 시작 전 반드시 다음을 확인한다.
- 작업장 상태 점검 (위험요인 제거 여부)
- 보호구 상태 점검 (손상 여부, 착용 적합성)
- 작업지시 확인 (작업 범위, 안전수칙)
- 이상 유무 보고 (작업 불가 상황 즉시 보고)`,
      },
      {
        title: '4. 작업 중 준수사항',
        content: `작업 중 다음 사항을 준수하여야 한다.
- 보호구 상시 착용 유지
- 정리정돈 유지 (작업구역 정리)
- 음주 후 작업 금지
- 무단이탈 금지
- 위험 발견 시 즉시 현장관리자에게 보고`,
      },
      {
        title: '5. 비상상황 시 조치',
        content: `비상상황 발생 시 다음에 따른다.
- 사고 또는 이상 발견 시 즉시 작업중지
- 현장관리자 또는 안전담당자에게 즉시 보고
- 응급조치 및 대피 지시에 따를 것
- 근로자는 급박한 위험이 있는 경우 작업을 중지하고 대피할 수 있다.`,
      },
      {
        title: '확인',
        content: `본인은 위 내용을 교육받았으며, 작업 중 이를 준수할 것을 확인합니다.
본 확인서는 근로관계 종료 후 3년간 보관합니다.`,
      },
    ],
    signatureBlock: `
교육담당자:  ${d.educatorName}   __________________ (서명 또는 인)
근로자:      ${d.workerName}   __________________ (서명 또는 인)
교육일:      ${d.educationDate}
`,
  }
}

// ─── 2. 작업변경 교육 확인서 ──────────────────────────────────

export interface TaskChangeEducationData extends ContractData {
  educationDate:    string
  educationHours:   number
  educationPlace:   string
  educatorName:     string
  prevTask:         string
  newTask:          string
  changeReason?:    string
}

export function renderTaskChangeEducation(d: TaskChangeEducationData): RenderedContract {
  return {
    templateType: 'SAFETY_EDUCATION_TASK_CHANGE',
    title:        '작업변경 안전보건교육 확인서',
    subtitle:     '(산업안전보건법 시행규칙 제26조 작업내용 변경 시 교육)',
    legalBasis:   '산업안전보건법 제29조, 동법 시행규칙 제26조',
    sections: [
      {
        title: '변경 내용',
        content: `근로자:       ${d.workerName}
현장명:       ${d.siteName}
변경 전 작업: ${d.prevTask}
변경 후 작업: ${d.newTask}
변경 사유:    ${d.changeReason || '현장 공정 변경'}`,
      },
      {
        title: '교육 개요',
        content: `교육 일시:   ${d.educationDate}
교육 장소:   ${d.educationPlace || d.siteName}
교육 시간:   ${d.educationHours}시간 이상
교육 실시자: ${d.educatorName}`,
      },
      {
        title: '교육 내용',
        content: `1. 변경된 작업의 위험요인 및 예방대책
2. 변경 작업에 필요한 개인보호구 종류 및 착용 방법
3. 변경 작업 관련 표준안전작업방법
4. 기계·기구·설비의 위험성 및 작업 시 주의사항
5. 비상 시 대피 요령 및 연락 체계
6. 해당 작업 관련 산업안전보건 법령 사항`,
      },
    ],
    signatureBlock: `
교육 실시자:  ${d.educatorName}   (서명 또는 인)
근로자 (이수자): ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 3. 보호구 지급 확인서 ────────────────────────────────────

export interface PPEItem {
  name:            string
  standard?:       string
  quantity:        number
  condition:       '신품' | '양호' | '재사용' | '기타'
  issued:          boolean          // 지급 여부
  explanationGiven?: boolean        // 착용방법 설명 여부
  needsReplacement?: boolean        // 교체 필요 여부
  note?:           string           // 비고
}

export interface PPEProvisionData extends ContractData {
  provisionDate: string
  workType:      string   // 고소작업, 굴착작업 등
  ppeItems:      PPEItem[]
  issuedBy:      string   // 지급자 성명
}

export function renderPPEProvision(d: PPEProvisionData): RenderedContract {
  function fmtItem(item: PPEItem, i: number): string {
    if (!item.issued) return `${i + 1}. ${item.name}: 미지급`
    return `${i + 1}. ${item.name}
   지급수량: ${item.quantity}개 / 상태: ${item.condition}${item.standard ? ` / 규격: ${item.standard}` : ''}
   착용방법 설명: ${item.explanationGiven ? '완료' : '미실시'} / 교체필요: ${item.needsReplacement ? '필요' : '해당없음'}${item.note ? `\n   비고: ${item.note}` : ''}`
  }

  const issuedItems = d.ppeItems.filter(i => i.issued)
  const itemBlock = d.ppeItems.map((item, i) => fmtItem(item, i)).join('\n\n')

  return {
    templateType: 'PPE_PROVISION',
    title:        '보호구 지급 확인서',
    subtitle:     '(산업안전보건법 제38조 개인보호구 지급 기록)',
    legalBasis:   '산업안전보건법 제38조, 동법 시행규칙 별표 6',
    sections: [
      {
        title: '지급 개요',
        content: `공사명:     ${(d as ContractData & {projectName?: string}).projectName || d.siteName}
현장명:     ${d.siteName}
현장주소:   ${(d as ContractData & {siteAddress?: string}).siteAddress || '             '}
공종:       ${(d as ContractData & {workType?: string}).workType || '             '}
세부공종:   ${(d as ContractData & {workTypeSub?: string}).workTypeSub || '             '}
직종:       ${(d as ContractData & {jobCategory?: string}).jobCategory || d.jobTitle}
담당업무:   ${(d as ContractData & {taskDescription?: string}).taskDescription || d.jobTitle}
근로자명:   ${d.workerName}
지급일자:   ${d.provisionDate}
지급자:     ${d.issuedBy}`,
      },
      {
        title: '보호구 지급 목록',
        content: itemBlock || '  (항목 없음)',
      },
      {
        title: '지급 요약',
        content: `지급 품목 수: ${issuedItems.length}종
지급 품목: ${issuedItems.map(i => i.name).join(', ') || '없음'}`,
      },
      {
        title: '수령 및 준수사항',
        content: `근로자는 지급받은 보호구를 작업 중 성실히 착용하여야 하며, 훼손·분실 또는 추가 지급이 필요한 경우 즉시 회사 또는 현장관리자에게 알려야 합니다.
① 보호구가 손상되거나 기능을 상실한 경우 즉시 관리자에게 보고하고 교체를 요청하여야 합니다.
② 보호구를 임의로 분해·개조하거나 용도 외 사용을 금지합니다.
③ 작업 종료 시 보호구를 지정 장소에 보관합니다.`,
      },
    ],
    signatureBlock: `
지급자:   ${d.issuedBy}   __________________ (서명 또는 인)
수령자:   ${d.workerName}   __________________ (서명 또는 인)
확인일:   ${d.contractDate}
`,
  }
}

// ─── 4. 안전수칙 준수 서약서 ──────────────────────────────────

export function renderSafetyPledge(d: ContractData): RenderedContract {
  return {
    templateType: 'SAFETY_PLEDGE',
    title:        '안전수칙 준수 서약서',
    subtitle:     `${d.siteName} 현장`,
    legalBasis:   '산업안전보건법 제6조(근로자의 의무), 제52조(작업중지권)',
    sections: [
      {
        title: '서약 내용',
        content: `본인 ${d.workerName}은(는) ${d.siteName} 현장에서 근무함에 있어 아래 안전수칙을 성실히 준수할 것을 서약합니다.`,
      },
      {
        title: '준수사항',
        content: `1. 안전보건교육에 성실히 참여하고 교육 내용을 실무에 적용한다.
2. 작업 전 안전점검(TBM)에 참여하고 위험요인을 공유한다.
3. 지급된 보호구(안전모·안전화·안전대·방진마스크 등)를 작업 중 항상 착용한다.
4. 고소작업 시 안전대를 부착하고 추락방지 조치를 확인한다.
5. 전기작업 시 전원 차단 여부를 확인하고 감전 예방조치를 이행한다.
6. 굴착·발파·화기작업 등 위험작업은 작업허가서 발급 후 실시한다.
7. 임의로 안전장치를 해제하거나 방호설비를 제거하지 않는다.
8. 위험요인 발견 즉시 작업을 중지하고 관리감독자에게 보고한다.
9. 급박한 위험이 있는 경우 작업을 중지하고 안전한 장소로 대피할 수 있다.
10. 동료 근로자의 안전에도 협력하고 위험행동을 발견 시 상호 제지한다.
11. 음주·약물 복용 상태로는 절대 작업에 임하지 않는다.
12. 현장 내 흡연은 지정 구역에서만 한다.`,
      },
      {
        title: '위반 시 조치',
        content: `안전수칙을 중대하게 위반하거나 반복적으로 지시에 따르지 않을 경우, 사용자는 관련 규정에 따라 재교육, 작업배치 제한, 현장출입 제한 등의 조치를 할 수 있습니다.`,
      },
    ],
    signatureBlock: `
서약자: ${d.workerName}   (서명 또는 인)
확인자 (현장관리자): ___________   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 5. 근로조건설명 및 계약서수령 확인서 ─────────────────────

export function renderWorkConditionsReceipt(d: ContractData & {
  workDate?: string
  tradeType?: string
  jobType?: string
  workPlace?: string
  managerName?: string
  workerBankName?: string
  workerAccountNumber?: string
  workerAccountHolder?: string
}): RenderedContract {
  const fmtWage = (n?: number) => n ? n.toLocaleString('ko-KR') + '원' : '___________원'
  const fmtTime = (t?: string) => t || '__:__'
  const breakDesc = d.breakStartTime && d.breakEndTime
    ? `${d.breakStartTime} ~ ${d.breakEndTime} (${d.breakHours ?? 1}시간)`
    : d.breakHours != null ? `${d.breakHours}시간` : '1시간'

  return {
    templateType: 'WORK_CONDITIONS_RECEIPT',
    title: '근로조건 설명 확인서',
    subtitle: '(근로기준법 제17조 — 근로조건 서면 교부·설명 의무)',
    legalBasis: '근로기준법 제17조, 동법 시행령 제8조',
    sections: [
      {
        title: '안내',
        content: `회사는 아래 근로조건을 근로자에게 설명하였고, 근로자는 그 내용을 확인하였습니다.`,
      },
      {
        title: '1. 기본 정보',
        content: `현장명: ${d.siteName}
공종: ${d.tradeType || d.workType || d.jobTitle}
직종: ${d.jobType || d.jobCategory || d.jobTitle}
근로일: ${d.workDate || d.startDate}
근무장소: ${d.workPlace || d.siteAddress || d.siteName}`,
      },
      {
        title: '2. 근로조건',
        content: `시업 시각: ${fmtTime(d.checkInTime)}
종업 시각: ${fmtTime(d.checkOutTime)}
휴게시간: ${breakDesc}
일급: ${fmtWage(d.dailyWage)}
임금지급일: 매월 ${d.paymentDay || '말일'}
임금지급방법: 근로자 본인 명의 계좌 지급`,
      },
      {
        title: '3. 추가 안내',
        content: `① 연장근로, 야간근로 또는 휴일근로가 발생하는 경우 관계 법령에 따라 별도로 처리될 수 있습니다.
② 주휴수당 등 법정수당은 관계 법령 및 실제 근로형태에 따라 발생하는 경우 처리됩니다.
③ 근로자는 현장 안전수칙, 보호구 착용 의무, 출퇴근 등록 절차를 준수하여야 합니다.`,
      },
    ],
    signatureBlock: `위 내용을 설명 듣고 확인하였습니다.

작성일: ${d.contractDate}

회사 또는 현장관리자
  성명: ${d.managerName || '             '}        (서명)

근로자
  성명: ${d.workerName}        (서명)
`,
  }
}

// ─── 5-B. 근로조건 설명 확인서 (상용직 버전) ─────────────────────

export function renderWorkConditionsReceiptRegular(d: ContractData & {
  managerName?: string
}): RenderedContract {
  const fmtMoney = (n?: number | null) => n ? n.toLocaleString('ko-KR') + '원' : '___________원'
  const fmtTime  = (t?: string) => t || '__:__'
  const breakDesc = d.breakStartTime && d.breakEndTime
    ? `${d.breakStartTime} ~ ${d.breakEndTime} (${d.breakHours ?? 1}시간)`
    : d.breakHours != null ? `${d.breakHours}시간` : '1시간'
  const contractPeriod = d.endDate
    ? `${d.startDate} ~ ${d.endDate}`
    : `${d.startDate} ~ (기간 정함 없음)`
  const weeklyWorkInfo = d.weeklyWorkDays || d.weeklyWorkHours
    ? `주 ${d.weeklyWorkDays ?? '?'}일, 주 ${d.weeklyWorkHours ?? '?'}시간`
    : '___일, ___시간'
  const probationText = (d as ContractData & { probationYn?: boolean; probationMonths?: number }).probationYn
    ? `시용기간 ${(d as ContractData & { probationMonths?: number }).probationMonths || '?'}개월 적용`
    : '시용기간 없음'
  const annualLeave = (d as ContractData & { annualLeaveRule?: string }).annualLeaveRule
    || '근로기준법 제60조에 따라 연차유급휴가를 부여한다.'

  return {
    templateType: 'WORK_CONDITIONS_RECEIPT_REGULAR' as never,
    title: '근로조건 설명 확인서',
    subtitle: '(근로기준법 제17조 — 상용직/기간제 근로조건 서면 교부·설명 의무)',
    legalBasis: '근로기준법 제17조, 동법 시행령 제8조',
    sections: [
      {
        title: '안내',
        content: `회사는 아래 근로조건을 근로자에게 설명하였고, 근로자는 그 내용을 확인하였습니다.`,
      },
      {
        title: '1. 기본 정보',
        content: `현장명: ${d.siteName}
공종: ${d.workType || d.jobTitle || '___'}
직종: ${d.jobCategory || d.jobTitle || '___'}
계약기간: ${contractPeriod}
근무장소: ${d.siteAddress || d.siteName}
${probationText}`,
      },
      {
        title: '2. 근로시간',
        content: `시업 시각: ${fmtTime(d.checkInTime)}
종업 시각: ${fmtTime(d.checkOutTime)}
휴게시간: ${breakDesc}
주 소정근로: ${weeklyWorkInfo}`,
      },
      {
        title: '3. 임금',
        content: `기본급: ${fmtMoney(d.monthlySalary)} (월)
임금지급일: 매월 ${d.paymentDay || '말일'}
임금지급방법: 근로자 본인 명의 계좌 지급`,
      },
      {
        title: '4. 연차유급휴가',
        content: annualLeave,
      },
      {
        title: '5. 추가 안내',
        content: `① 연장·야간·휴일근로가 발생하는 경우 관계 법령에 따라 가산수당이 지급됩니다.
② 4대보험은 가입 요건에 해당하는 경우 법령에 따라 처리됩니다.
③ 근로자는 현장 안전수칙, 보호구 착용 의무, 출퇴근 등록 절차를 준수하여야 합니다.`,
      },
    ],
    signatureBlock: `위 내용을 설명 듣고 확인하였습니다.

작성일: ${d.contractDate}

회사 또는 현장관리자
  성명: ${d.managerName || '             '}        (서명)

근로자
  성명: ${d.workerName}        (서명)
`,
  }
}

// ─── 6. 개인정보수집·이용 동의서 ──────────────────────────────

export function renderPrivacyConsent(d: ContractData): RenderedContract {
  return {
    templateType: 'PRIVACY_CONSENT',
    title: '개인정보 수집·이용 동의서',
    subtitle: '(개인정보 보호법 제15조 — 수집·이용 동의)',
    legalBasis: '개인정보 보호법 제15조, 제17조, 제22조',
    sections: [
      {
        title: '안내',
        content: `${d.companyName}(이하 "회사")는 근로계약 체결 및 이행, 임금 지급, 4대보험 신고, 출퇴근 및 노무관리, 관계 법령상 의무 이행을 위하여 아래와 같이 개인정보를 수집·이용합니다.`,
      },
      {
        title: '1. 수집 항목',
        content: `• 성명
• 생년월일
• 주소
• 연락처
• 계좌정보
• 신분확인정보
• 보험신고 및 노무관리상 필요한 정보`,
      },
      {
        title: '2. 이용 목적',
        content: `• 근로계약 체결 및 관리
• 임금 지급
• 4대보험, 세무, 노무 관련 신고 및 처리
• 출퇴근 및 현장 인원관리
• 법령상 의무 이행 및 분쟁 대응`,
      },
      {
        title: '3. 보유 및 이용기간',
        content: `관계 법령에서 정한 기간 또는 수집·이용 목적 달성 시까지 보관·이용합니다.`,
      },
      {
        title: '4. 동의 거부 권리',
        content: `근로자는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 다만, 필수정보 제공이 없을 경우 근로계약 체결, 임금 지급, 보험 처리 등에 제한이 있을 수 있습니다.`,
      },
      {
        title: '5. 동의',
        content: `개인정보 수집·이용에 동의합니다.

  [ ] 동의함

  [ ] 동의하지 않음`,
      },
    ],
    signatureBlock: `작성일: ${d.contractDate}

근로자
  성명: ${d.workerName}        (서명)
`,
  }
}

// ─── 6. 건설업 기초안전보건교육 확인서 ───────────────────────
export function renderBasicSafetyEduConfirm(d: ContractData & {
  workDate?: string
  eduCompletedYn?: boolean
  eduCompletedDate?: string
  eduOrganization?: string
  eduCertConfirmedYn?: boolean
  eduCertConfirmedDate?: string
  confirmerName?: string
}): RenderedContract {
  const completedYn = d.eduCompletedYn ?? false
  const certConfirmedYn = d.eduCertConfirmedYn ?? false

  return {
    templateType: 'BASIC_SAFETY_EDU_CONFIRM',
    title: '건설업 기초안전보건교육 확인서',
    subtitle: '(산업안전보건법 제31조 — 건설업 기초안전보건교육)',
    legalBasis: '산업안전보건법 제31조, 동법 시행규칙 제26조의2',
    sections: [
      {
        title: '근로자 정보',
        content: `성명: ${d.workerName}
생년월일: ${d.workerBirthDate || '             '}
현장명: ${d.siteName}
근로일: ${d.workDate || d.startDate}`,
      },
      {
        title: '1. 기초안전보건교육 이수 여부',
        content: `건설업 기초안전보건교육 이수 여부: ${completedYn ? '[√] 이수' : '[ ] 이수   [ ] 미이수'}
이수일: ${d.eduCompletedDate || '____년 __월 __일'}
교육기관명: ${d.eduOrganization || '             '}`,
      },
      {
        title: '2. 이수증 확인',
        content: `이수증 원본 확인 여부: ${certConfirmedYn ? '[√] 확인' : '[ ] 확인   [ ] 미확인'}
확인일: ${d.eduCertConfirmedDate || '____년 __월 __일'}
확인자 성명: ${d.confirmerName || '             '}`,
      },
      {
        title: '3. 안내',
        content: `① 건설업 기초안전보건교육을 이수하지 않은 근로자는 건설현장 출입 및 작업이 제한될 수 있습니다.
② 미이수 확인 시 현장 입장 전 교육 이수를 완료하여야 합니다.
③ 이수증은 근로관계 종료 후 3년간 보존합니다.`,
      },
    ],
    signatureBlock: `위 내용을 확인하였습니다.

작성일: ${d.contractDate}

확인자 (현장관리자)
  성명: ${d.confirmerName || '             '}        (서명)

근로자
  성명: ${d.workerName}        (서명)
`,
  }
}

// ─── 7. 현장 안전수칙 준수 확인서 ────────────────────────────
export function renderSiteSafetyRulesConfirm(d: ContractData & {
  workDate?: string
  specialSafetyRules?: string
  confirmerName?: string
}): RenderedContract {
  return {
    templateType: 'SITE_SAFETY_RULES_CONFIRM',
    title: '현장 안전수칙 준수 확인서',
    subtitle: '(산업안전보건법 제38조·제39조 — 위험방지 의무)',
    legalBasis: '산업안전보건법 제38조, 제39조, 제63조',
    sections: [
      {
        title: '기본 정보',
        content: `현장명: ${d.siteName}
근로자 성명: ${d.workerName}
근로일: ${d.workDate || d.startDate}`,
      },
      {
        title: '안전수칙 확인 항목',
        content: `아래 항목을 읽고 준수할 것을 확인합니다.

[√] 보호구(안전모, 안전화, 안전대 등) 착용 의무 준수
[√] 현장관리자의 안전지시 준수 의무
[√] 위험구역 무단출입 금지
[√] 음주 후 작업 금지
[√] 위험 발견 시 즉시 보고 의무
[√] 사고 발생 시 즉시 보고 의무
[√] 출퇴근 등록 절차 준수 의무${d.specialSafetyRules ? `\n[√] 특이 안전수칙: ${d.specialSafetyRules}` : ''}`,
      },
      {
        title: '서약',
        content: `본인은 위 안전수칙을 숙지하였으며, 현장에서 이를 성실히 준수할 것을 확인합니다.`,
      },
    ],
    signatureBlock: `작성일: ${d.contractDate}

관리자
  성명: ${d.confirmerName || '             '}        (서명)

근로자
  성명: ${d.workerName}        (서명)
`,
  }
}

// ─── 7. 현장배치 확인서 ───────────────────────────────────────

export interface SiteAssignmentData extends ContractData {
  prevSiteName:   string
  prevSiteAddr?:  string
  assignDate:     string
  wageUnchanged:  boolean
  conditionNote?: string
}

export function renderSiteAssignment(d: SiteAssignmentData): RenderedContract {
  return {
    templateType: 'SITE_ASSIGNMENT',
    title:        '현장배치 확인서',
    subtitle:     '(근로기준법 제17조 — 취업 장소 변경에 따른 서면 교부)',
    legalBasis:   '근로기준법 제17조',
    sections: [
      {
        title: '배치 내용',
        content: `근로자:       ${d.workerName}
직종:         ${d.jobTitle}
배치 일자:    ${d.assignDate}

이전 현장:    ${d.prevSiteName}${d.prevSiteAddr ? ` (${d.prevSiteAddr})` : ''}
신규 현장:    ${d.siteName}${d.siteAddress ? ` (${d.siteAddress})` : ''}`,
      },
      {
        title: '근로조건 변경 여부',
        content: `임금, 근로시간, 업무 내용 등 주요 근로조건: ${d.wageUnchanged ? '변경 없음' : '변경 있음 (근로조건 변경확인서 별도 발행)'}
${d.conditionNote ? '특이사항: ' + d.conditionNote : ''}`,
      },
      {
        title: '확인',
        content: `위 현장 배치에 동의하며 신규 현장의 안전수칙 및 관련 교육에 성실히 임할 것을 확인합니다.`,
      },
    ],
    signatureBlock: `
사용자 확인:  ${d.companyName} ${d.companyCeo}   (서명 또는 인)
근로자 확인:  ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 6. 근로조건 변경확인서 ───────────────────────────────────

export interface WorkConditionChange {
  item:   string   // '임금' | '근로시간' | '휴일' | '업무' | '기타'
  before: string
  after:  string
}

export interface WorkConditionChangeData extends ContractData {
  changeDate:   string
  changeReason: string
  changes:      WorkConditionChange[]
}

export function renderWorkConditionChange(d: WorkConditionChangeData): RenderedContract {
  const changeRows = d.changes.map((c, i) =>
    `  ${i + 1}. [${c.item}]\n     변경 전: ${c.before}\n     변경 후: ${c.after}`
  ).join('\n')

  return {
    templateType: 'WORK_CONDITION_CHANGE',
    title:        '근로조건 변경확인서',
    subtitle:     '(근로기준법 제17조 — 임금·근로시간·업무 등 변경 시 서면 교부 의무)',
    legalBasis:   '근로기준법 제17조',
    sections: [
      {
        title: '당사자',
        content: `사용자:   ${d.companyName} (대표 ${d.companyCeo})
근로자:   ${d.workerName} / ${d.jobTitle}
변경 일자: ${d.changeDate}
변경 사유: ${d.changeReason}`,
      },
      {
        title: '변경 내용',
        content: changeRows || '  (변경 항목 없음)',
      },
      {
        title: '확인',
        content: `위 근로조건 변경에 대해 상호 협의하였으며, 변경된 내용을 확인합니다.
본 확인서는 근로관계 종료 후 3년간 보관합니다.`,
      },
    ],
    signatureBlock: `
사용자:   ${d.companyName} ${d.companyCeo}   (서명 또는 인)
근로자:   ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 7. 안전보건협의체 회의록 ─────────────────────────────────

export interface SafetyCouncilData extends ContractData {
  meetingDate:    string
  meetingPlace:   string
  attendees:      { name: string; company: string; role: string }[]
  agendaItems:    string[]
  decisions:      string[]
  nextMeetingDate?: string
}

export function renderSafetyCouncilMinutes(d: SafetyCouncilData): RenderedContract {
  const attendeeRows = d.attendees.map((a, i) =>
    `  ${i + 1}. ${a.name} (${a.company} / ${a.role})`
  ).join('\n')
  const agendaRows = d.agendaItems.map((a, i) => `  ${i + 1}. ${a}`).join('\n')
  const decisionRows = d.decisions.map((dec, i) => `  ${i + 1}. ${dec}`).join('\n')

  return {
    templateType: 'SAFETY_COUNCIL_MINUTES',
    title:        '안전보건협의체 회의록',
    subtitle:     '(산업안전보건법 제75조 — 도급인·수급인 합동 안전보건협의체)',
    legalBasis:   '산업안전보건법 제75조, 동법 시행규칙 제79조',
    sections: [
      {
        title: '회의 개요',
        content: `회의 일시:  ${d.meetingDate}
회의 장소:  ${d.meetingPlace || d.siteName}
현장명:     ${d.siteName}
주관:       ${d.companyName} (도급인)`,
      },
      {
        title: '참석자',
        content: attendeeRows || '  (참석자 없음)',
      },
      {
        title: '안건',
        content: agendaRows || '  (안건 없음)',
      },
      {
        title: '결정사항',
        content: decisionRows || '  (결정사항 없음)',
      },
      {
        title: '차기 회의',
        content: `차기 회의 예정일: ${d.nextMeetingDate || '추후 공지'}
본 회의록은 산업안전보건법 제75조에 따른 협의체 운영 근거 서류로 보관합니다.`,
      },
    ],
    signatureBlock: `
작성자 (도급인 안전담당): ___________   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 8. 순회점검 기록 ─────────────────────────────────────────

export interface InspectionItem {
  area:       string
  item:       string
  result:     '적합' | '부적합' | '해당없음'
  action?:    string
}

export interface SiteInspectionData extends ContractData {
  inspectionDate:     string
  inspectorName:      string
  inspectorPosition:  string
  items:              InspectionItem[]
  overallResult:      '이상없음' | '시정필요' | '즉시중단'
  actionDeadline?:    string
}

export function renderSiteInspection(d: SiteInspectionData): RenderedContract {
  const itemRows = d.items.map((item, i) =>
    `  ${i + 1}. [${item.area}] ${item.item} — ${item.result}${item.action ? ' ※시정: ' + item.action : ''}`
  ).join('\n')

  return {
    templateType: 'SITE_INSPECTION_RECORD',
    title:        '순회점검 기록',
    subtitle:     '(산업안전보건법 제64조 — 도급인의 수급인 작업 순회점검)',
    legalBasis:   '산업안전보건법 제64조, 동법 시행규칙 제80조',
    sections: [
      {
        title: '점검 개요',
        content: `점검 일시:    ${d.inspectionDate}
현장명:       ${d.siteName}
점검자:       ${d.inspectorName} (${d.inspectorPosition})
종합 결과:    ${d.overallResult}
${d.actionDeadline ? '시정 기한: ' + d.actionDeadline : ''}`,
      },
      {
        title: '점검 항목',
        content: itemRows || '  (항목 없음)',
      },
      {
        title: '조치 사항',
        content: `부적합 사항 발생 시 즉시 수급인에게 통보하고 시정을 요구하였습니다.
본 기록은 산업안전보건법 제64조에 따른 순회점검 근거 서류로 보관합니다.`,
      },
    ],
    signatureBlock: `
점검자:   ${d.inspectorName} (${d.inspectorPosition})   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 9. 수급인 교육실시 확인 기록 ─────────────────────────────

export interface SubcontractorEducationData extends ContractData {
  educationDate:      string
  subcontractorName:  string
  subcontractorRep:   string
  educationTopic:     string
  educationHours:     number
  attendeeCount:      number
  confirmedBy:        string   // 원청 확인자
}

export function renderSubcontractorEducationRecord(d: SubcontractorEducationData): RenderedContract {
  return {
    templateType: 'SUBCONTRACTOR_EDUCATION_RECORD',
    title:        '수급인 교육실시 확인 기록',
    subtitle:     '(산업안전보건법 제64조 — 도급인의 수급인 교육지원 및 확인)',
    legalBasis:   '산업안전보건법 제64조 제1항 제4호',
    sections: [
      {
        title: '교육 개요',
        content: `교육 일시:       ${d.educationDate}
현장명:          ${d.siteName}
수급인:          ${d.subcontractorName} (대표: ${d.subcontractorRep})
교육 주제:       ${d.educationTopic}
교육 시간:       ${d.educationHours}시간
참석 인원:       ${d.attendeeCount}명
원청 확인자:     ${d.confirmedBy}`,
      },
      {
        title: '확인 내용',
        content: `원청(도급인)은 위 수급인이 소속 근로자에 대한 안전보건교육을 실시하였음을 확인하였습니다.
도급인은 수급인의 교육 실시를 지원하고 결과를 기록·보관합니다.`,
      },
    ],
    signatureBlock: `
수급인 대표:     ${d.subcontractorRep}   (서명 또는 인)
원청 확인자:     ${d.confirmedBy}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}
