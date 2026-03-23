/**
 * 사업자 없는 팀장형 예외 서면 세트
 * 기본값: REVIEW_REQUIRED — 직접고용 전환 검토 우선
 */

import type { ContractData, RenderedContract } from './templates'

export interface TeamLeaderData extends ContractData {
  teamSize?:      number         // 팀 인원 수
  changeReason?:  string
  // 직접고용 여부 체크
  attendanceControlledByCompany: boolean
  payDecidedByCompany:           boolean
  directPaymentByCompany:        boolean
}

// ─── C-1. 팀장 책임확인서 ─────────────────────────────────────

export function renderTeamLeaderResponsibility(d: TeamLeaderData): RenderedContract {
  const hasDirectControl = d.attendanceControlledByCompany || d.payDecidedByCompany || d.directPaymentByCompany

  return {
    templateType: 'TEAM_LEADER_RESPONSIBILITY',
    title:        '팀장 책임확인서',
    subtitle:     hasDirectControl
      ? '⛔ 직접고용 재분류 필요 — 본 서면 단독 사용 불가'
      : '⚠ [검토 필요] 상태 — 관리자 확인 후 효력 발생',
    legalBasis:   '근로기준법, 파견근로자 보호 등에 관한 법률, 산업안전보건법',
    sections: [
      {
        title: '서면 목적 및 법적 성격',
        content: `① 본 서면은 팀장 "${d.workerName}"이(가) 공정 수행에 관한 책임 범위와 제출 자료를 확인하기 위한 것입니다.
② 본 서면은 팀장 또는 소속 인력과 "${d.companyName}"(이하 "회사") 사이의 근로계약, 파견계약, 도급계약을 구성하지 않습니다.
③ 실제 운영 구조가 회사가 직접 지휘·감독하고 개인별로 임금을 지급하는 직접고용 구조에 해당하는 경우, 본 서면은 효력이 없으며 해당 인력은 개별 근로계약 대상으로 즉시 재분류합니다.`,
      },
      {
        title: '팀장 정보',
        content: `성명:       ${d.workerName}
연락처:     ${d.workerPhone || '         '}
현장명:     ${d.siteName}
담당 공정:  ${d.taskDescription || d.jobTitle}
팀 인원:    ${d.teamSize != null ? d.teamSize + '명' : '미정'}
기간:       ${d.startDate} ~ ${d.endDate || '공정 완료 시까지'}`,
      },
      {
        title: '팀장 확인 및 서약',
        content: `팀장은 다음 사항을 확인하고 서약합니다.

□ 본 팀의 인력 구성, 배치, 작업 방법에 관한 1차적 결정은 팀장이 합니다.
□ 팀 내 인력에 대한 보수 배분은 팀 내부 규칙에 따라 팀장이 책임지고 처리합니다.
□ 팀장은 소속 인력에 관한 세무 처리(원천징수 등 법령상 의무 해당 시)를 별도로 이행합니다.
□ 팀장은 회사가 해당 인력의 4대보험·세금을 임의로 미적용·미납하도록 강요하지 않았음을 확인합니다.
□ 본 팀의 실제 운영이 회사의 직접 지휘·개인지급 구조에 해당하지 않음을 확인합니다.`,
      },
      {
        title: '4대보험 적용 원칙',
        content: `① 본 서면만으로 소속 인력의 4대보험 가입의무를 배제하지 않습니다.
② 실제 법률관계가 근로자에 해당하는 경우, 관계 법령에 따라 사회보험 가입 및 공제를 처리합니다.
③ 팀장 또는 소속 인력이 사회보험 가입을 원하지 아니한다는 의사를 표시하더라도, 관계 법령상 가입 대상에 해당하는 경우에는 법령에 따라 처리합니다.`,
      },
      ...(hasDirectControl ? [{
        title: '⛔ 관리자 경고',
        content: `본 계약은 아래 항목에 해당하여 팀장형 서면 단독 사용이 부적절합니다.

${d.attendanceControlledByCompany ? '• 회사가 팀원 개인별 출퇴근을 직접 관리함' : ''}
${d.payDecidedByCompany ? '• 회사가 팀원 개인별 금액을 직접 결정함' : ''}
${d.directPaymentByCompany ? '• 회사가 팀원 개인에게 직접 지급함' : ''}

→ 개별 일용직 근로계약서로 재분류하여 처리하십시오.`,
      }] : []),
    ],
    signatureBlock: `
회사 확인
  상호: ${d.companyName}
  담당자: ___________   (서명 또는 인)

팀장 확인
  성명: ${d.workerName}   (서명 또는 인)

* 본 서면은 관리자 검토 완료 후 최종 효력이 발생합니다.
작성일: ${d.contractDate}
`,
  }
}

// ─── C-2. 공정수행 범위 확인서 ───────────────────────────────

export function renderTeamScopeConfirmation(d: TeamLeaderData): RenderedContract {
  return {
    templateType: 'TEAM_SCOPE_CONFIRMATION',
    title:        '공정수행 범위 확인서',
    subtitle:     `${d.siteName} — 팀장: ${d.workerName}`,
    legalBasis:   '팀장 책임확인서 관련',
    sections: [
      {
        title: '공정 정보',
        content: `현장명:       ${d.siteName}
담당 공정:    ${d.taskDescription || d.jobTitle}
수행 기간:    ${d.startDate} ~ ${d.endDate || '공정 완료 시까지'}
팀 인원:      ${d.teamSize != null ? d.teamSize + '명' : '미정'}`,
      },
      {
        title: '수행 범위',
        content: `팀장은 다음 범위를 독립적으로 수행합니다.
(세부 범위는 현장 관리자와 협의하여 기재)

수행 범위:
___________________________________________________________
___________________________________________________________

제외 범위:
___________________________________________________________`,
      },
      {
        title: '수행 방식 확인',
        content: `① 팀장은 공정 수행 방법과 인원 배치를 자체적으로 결정합니다.
② 회사는 공정 결과물과 품질·안전을 확인하며, 개별 작업 지시는 하지 않습니다.
③ 공정 수행에 필요한 자재·공구의 부담 주체: ___________
④ 공정 완료 기준: ___________`,
      },
    ],
    signatureBlock: `
회사 확인: ___________   (서명 또는 인)
팀장 확인: ${d.workerName}   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── C-3. 안전보건 준수확인서 ────────────────────────────────

export function renderTeamSafetyCompliance(d: TeamLeaderData): RenderedContract {
  return {
    templateType: 'TEAM_SAFETY_COMPLIANCE',
    title:        '안전보건 준수확인서 (팀장형)',
    subtitle:     `${d.siteName} — 팀장: ${d.workerName}`,
    legalBasis:   '산업안전보건법 제6조, 제29조, 제52조',
    sections: [
      {
        title: '준수 사항',
        content: `팀장 "${d.workerName}"은(는) 소속 팀원과 함께 아래 안전보건 사항을 준수합니다.

□ 신규 투입 팀원에 대해 안전보건교육을 사전에 실시하거나 실시 여부를 확인한다.
□ 작업 전 TBM(안전교육)을 실시하고 위험요인을 팀원과 공유한다.
□ 개인보호구(안전모·안전화·안전대 등)를 착용하고 팀원의 착용을 지도한다.
□ 추락·감전·붕괴 등 위험요인 발견 즉시 회사 현장관리자에게 보고한다.
□ 급박한 위험이 있는 경우 작업을 중지하고 대피한 후 즉시 보고한다.
□ 회사의 순회점검 및 안전지도에 적극 협력한다.
□ 화기작업·고소작업 등 위험작업은 회사의 사전 승인 후 실시한다.`,
      },
      {
        title: '위반 시 조치',
        content: `안전수칙을 중대하게 위반하는 경우 회사는 해당 팀의 작업을 즉시 중단시키고 시정 후 재개할 수 있습니다.`,
      },
    ],
    signatureBlock: `
팀장 확인: ${d.workerName}   (서명 또는 인)
회사 확인: ___________   (서명 또는 인)

작성일: ${d.contractDate}
`,
  }
}

// ─── C-4. 내부 배분 참고자료 제출서 ─────────────────────────

export function renderTeamDistributionSubmission(d: TeamLeaderData): RenderedContract {
  return {
    templateType: 'TEAM_DISTRIBUTION_SUBMISSION',
    title:        '내부 인력배분 참고자료 제출서',
    subtitle:     '⚠ 원청 임금 직접지급 근거 아님',
    legalBasis:   '팀장 책임확인서 제4조 관련',
    sections: [
      {
        title: '주의사항 (필독)',
        content: `본 자료는 기성 정산 참고를 위해 팀장이 제출하는 내부 배분 참고자료입니다.

⚠ 원청은 본 자료를 기준으로 팀원 개인에게 직접 송금하지 않습니다.
⚠ 개인별 금액 결정과 지급은 팀장의 책임입니다.
⚠ 본 자료가 근로계약 또는 임금 지급의무의 근거로 해석될 수 없습니다.`,
      },
      {
        title: '배분 내역 (팀장 작성)',
        content: `팀장: ${d.workerName}
현장: ${d.siteName}
기간: ___________
총액: ___________

  번호 | 성명 | 역할 | 기간 | 공수 | 배분 금액 | 비고
  ─────────────────────────────────────────────────
  1.   |      |      |      |      |           |
  2.   |      |      |      |      |           |
  3.   |      |      |      |      |           |
  ─────────────────────────────────────────────────
  합계 |      |      |      |      |           |`,
      },
    ],
    signatureBlock: `
팀장 확인: ${d.workerName}   (서명 또는 인)
제출 일자: ___________
`,
  }
}

// ─── C-5. 직접고용 재분류 경고서 ─────────────────────────────

export function renderReclassificationWarning(d: TeamLeaderData): RenderedContract {
  const reasons: string[] = []
  if (d.attendanceControlledByCompany) reasons.push('회사가 팀원 개인별 출퇴근을 직접 관리함')
  if (d.payDecidedByCompany)           reasons.push('회사가 팀원 개인별 일당·금액을 직접 결정함')
  if (d.directPaymentByCompany)        reasons.push('회사가 팀원 개인에게 직접 지급함')

  return {
    templateType: 'TEAM_RECLASSIFICATION_WARNING',
    title:        '직접고용 재분류 경고서',
    subtitle:     `⛔ ${d.siteName} — ${d.workerName} 팀 관련`,
    legalBasis:   '근로기준법, 파견근로자 보호 등에 관한 법률 제2조',
    sections: [
      {
        title: '경고 사유',
        content: `아래 사유로 인해 현재 운영 구조가 외주·팀장형 계약이 아닌 직접고용에 해당할 가능성이 있습니다.

${reasons.map((r, i) => `  ${i + 1}. ${r}`).join('\n') || '  (사유 미입력)'}`,
      },
      {
        title: '법적 리스크',
        content: `① 도급·파견의 판단은 계약서 제목이 아니라 실제 지휘·명령 관계, 인사·노무 결정 주체, 독립 조직·설비 보유 여부를 기준으로 합니다.
② 위 사유에 해당하는 경우 위장도급 또는 불법파견으로 판단될 수 있습니다.
③ 불법파견이 인정될 경우 사용사업주(원청)는 직접고용 의무가 발생합니다.
④ 세무처리 3.3%만으로는 노동법상 외주로 보호되지 않습니다.`,
      },
      {
        title: '조치 지시',
        content: `관리자는 다음 조치 중 하나를 즉시 이행하여야 합니다.

□ 해당 인력을 개별 일용직 근로계약으로 전환 (권고)
□ 직접 지휘·관리를 중단하고 실질적 외주 구조로 변경
□ 법무 검토 의뢰 후 서면 처리

본 경고서는 내부 관리 목적으로 발행되며, 해당 인력의 근로계약서가 작성될 때까지 보관합니다.`,
      },
    ],
    signatureBlock: `
발행일: ${d.contractDate}
발행자 (관리자): ___________   (서명 또는 인)
수령자 (담당자): ___________   (서명 또는 인)
`,
  }
}
