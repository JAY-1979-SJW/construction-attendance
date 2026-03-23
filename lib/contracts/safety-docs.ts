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
    title:        '신규채용 안전보건교육 확인서',
    subtitle:     '(산업안전보건법 시행규칙 제26조·별표 5 기준)',
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
        title: '교육 내용',
        content: NEW_HIRE_EDUCATION_CONTENTS.join('\n'),
      },
      {
        title: '확인 사항',
        content: `본 교육을 이수하였음을 확인합니다.
교육실시자는 위 근로자에게 산업안전보건법 시행규칙 별표 5에 따른 내용을 교육하였습니다.
본 확인서는 근로관계 종료 후 3년간 보관합니다.`,
      },
    ],
    signatureBlock: `
교육 실시자:  ${d.educatorName}   (서명 또는 인)
근로자 (이수자): ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
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
  name:       string   // 안전모, 안전화, 안전대 등
  standard?:  string   // 규격/등급
  quantity:   number
  condition:  '신품' | '재사용'
}

export interface PPEProvisionData extends ContractData {
  provisionDate: string
  workType:      string   // 고소작업, 굴착작업 등
  ppeItems:      PPEItem[]
  issuedBy:      string   // 지급자 성명
}

export function renderPPEProvision(d: PPEProvisionData): RenderedContract {
  const itemRows = d.ppeItems.map((item, i) =>
    `  ${i + 1}. ${item.name}${item.standard ? ` (${item.standard})` : ''} — ${item.quantity}개 — ${item.condition}`
  ).join('\n')

  return {
    templateType: 'PPE_PROVISION',
    title:        '보호구 지급 확인서',
    subtitle:     '(산업안전보건법 제38조 개인보호구 지급 기록)',
    legalBasis:   '산업안전보건법 제38조, 동법 시행규칙 별표 6',
    sections: [
      {
        title: '지급 개요',
        content: `지급 일자:  ${d.provisionDate}
근로자:     ${d.workerName}
현장명:     ${d.siteName}
작업 종류:  ${d.workType}
지급자:     ${d.issuedBy}`,
      },
      {
        title: '지급 보호구 목록',
        content: itemRows || '  (항목 없음)',
      },
      {
        title: '수령 및 준수사항',
        content: `① 근로자는 지급받은 보호구를 작업 중 반드시 착용하고 올바르게 사용하여야 합니다.
② 보호구가 손상되거나 기능을 상실한 경우 즉시 관리자에게 보고하고 교체를 요청하여야 합니다.
③ 보호구를 임의로 분해·개조하거나 용도 외 사용을 금지합니다.
④ 작업 종료 시 보호구를 지정 장소에 보관합니다.`,
      },
    ],
    signatureBlock: `
지급자:   ${d.issuedBy}   (서명 또는 인)
수령자:   ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
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

export function renderWorkConditionsReceipt(d: ContractData): RenderedContract {
  return {
    templateType: 'WORK_CONDITIONS_RECEIPT',
    title:        '근로조건설명 및 계약서수령 확인서',
    subtitle:     '(근로기준법 제17조 — 근로조건 서면 교부·설명 의무)',
    legalBasis:   '근로기준법 제17조, 동법 시행령 제8조',
    sections: [
      {
        title: '근로자 정보',
        content: `성명:       ${d.workerName}
연락처:     ${d.workerPhone || '             '}
현장명:     ${d.siteName}
직종:       ${d.jobTitle}
근로 시작일: ${d.startDate}`,
      },
      {
        title: '주요 근로조건 설명 확인',
        content: `사용자는 근로계약 체결 시 다음의 근로조건을 근로자에게 서면으로 명시하고 설명하였습니다.

□ 임금 (일당/월급, 계산방법, 지급일, 지급방법)
   - 일당: ${d.dailyWage ? d.dailyWage.toLocaleString('ko-KR') + '원' : '미정'}
   - 지급일: 매월 ${d.paymentDay || '말일'}
   - 지급방법: ${d.paymentMethod || '계좌이체'}

□ 소정근로시간
   - 시업: ${d.checkInTime || '08:00'} / 종업: ${d.checkOutTime || '17:00'}
   - 휴게: ${d.breakStartTime && d.breakEndTime ? `${d.breakStartTime} ~ ${d.breakEndTime}` : `${d.breakHours ?? 1}시간`}

□ 취업 장소 및 종사 업무
   - 현장: ${d.siteName}
   - 직종/업무: ${d.jobTitle}

□ 근로계약 기간
   - 시작: ${d.startDate} / 종료: ${d.endDate || '무기한'}

□ 4대보험 적용 여부
   - 국민연금: ${d.nationalPensionYn ? '적용' : '미적용'} / 건강보험: ${d.healthInsuranceYn ? '적용' : '미적용'}
   - 고용보험: ${d.employmentInsuranceYn ? '적용' : '미적용'} / 산재보험: ${d.industrialAccidentYn ? '적용' : '미적용'}`,
      },
      {
        title: '계약서 수령 확인',
        content: `본인은 사용자로부터 위 근로조건에 대한 충분한 설명을 듣고 근로계약서 1부를 교부받았음을 확인합니다.

- 계약서 수령 방법: □ 종이 직접 수령  □ 전자문서(앱/이메일)
- 내용을 이해하였습니까?: □ 예  □ 아니오 (아니오인 경우 추가 설명 요청)

본 확인서는 근로기준법 제17조에 따른 서면 교부 의무 이행의 근거로 보관합니다.`,
      },
    ],
    signatureBlock: `
사용자 확인:  ${d.companyName} ${d.companyCeo}   (서명 또는 인)
근로자 확인:  ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── 6. 개인정보수집·이용 동의서 ──────────────────────────────

export function renderPrivacyConsent(d: ContractData): RenderedContract {
  return {
    templateType: 'PRIVACY_CONSENT',
    title:        '개인정보수집·이용 동의서',
    subtitle:     '(개인정보 보호법 제15조 — 수집·이용 동의)',
    legalBasis:   '개인정보 보호법 제15조, 제17조, 제22조',
    sections: [
      {
        title: '개인정보 수집·이용 목적',
        content: `① 근로계약 체결 및 이행에 관한 사항
② 출퇴근 관리 및 근태 기록 (GPS 위치 인증)
③ 임금 계산, 지급 및 세무 처리
④ 4대보험 가입·신고 및 보험료 처리
⑤ 산업재해 예방 및 처리
⑥ 법정 의무사항 이행 (근로기준법, 산업안전보건법 등)`,
      },
      {
        title: '수집하는 개인정보 항목',
        content: `필수 항목:
  - 성명, 생년월일, 연락처(휴대전화), 주소
  - 은행계좌번호, 예금주명 (임금 지급용)
  - GPS 위치 정보 (출퇴근 인증 시)
  - 근로 내역 (출퇴근 기록, 공수, 임금 지급 내역)

선택 항목:
  - 비상연락처, 보건정보 (안전 조치 목적)`,
      },
      {
        title: '보유 및 이용 기간',
        content: `① 근로관계 유지 기간 동안 보유·이용합니다.
② 근로관계 종료 후: 근로기준법에 따라 3년간 보존 후 파기합니다.
③ 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보존합니다.
  - 고용보험·산재보험 관련 서류: 3년
  - 세금 관련 서류: 5년 (국세기본법)`,
      },
      {
        title: '제3자 제공',
        content: `수집된 개인정보는 다음의 경우에 제3자에게 제공될 수 있습니다.
① 4대보험 기관 (국민건강보험공단, 국민연금공단, 근로복지공단, 고용노동부)
② 세무 신고 (국세청, 지방자치단체)
③ 법원, 수사기관 등 법령에 따른 요청
④ 기타 본인의 사전 동의를 받은 경우`,
      },
      {
        title: '동의 거부 권리 및 불이익',
        content: `귀하는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.
다만, 필수 항목에 대한 동의를 거부하시는 경우 근로계약 체결 및 출퇴근 관리가 불가능합니다.

※ 개인정보 처리에 관한 문의: ${d.companyName} (${d.companyAddress})`,
      },
      {
        title: '동의 확인',
        content: `본인은 위 개인정보 수집·이용에 관한 내용을 충분히 읽고 이해하였으며 이에 동의합니다.

필수 항목 동의: □ 동의함  □ 동의하지 않음
선택 항목 동의: □ 동의함  □ 동의하지 않음`,
      },
    ],
    signatureBlock: `
근로자 성명: ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
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
