/**
 * 계약서 문안 템플릿 라이브러리
 * 근로기준법 제17조·시행령 제8조·기간제법 제17조·산업안전보건법 기준
 */

export interface ContractData {
  // 공통
  companyName:       string
  companyCeo:        string
  companyAddress:    string
  companyBizNo?:     string   // 사업자등록번호
  workerName:        string
  workerBirthDate?:  string
  workerAddress?:    string
  workerPhone?:      string
  siteName:          string
  siteAddress?:      string
  jobTitle:          string
  taskDescription?:  string
  projectName?:      string   // 공사명
  workType?:         string   // 공종 (전기/소방전기/소방기계/기계설비/통신/기타)
  workTypeSub?:      string   // 세부공종
  jobCategory?:      string   // 직종 (보통인부/특별인부/조공/전공/기능공/기사반장/기타)
  jobCategorySub?:   string   // 세부직종
  contractForm?:     string   // 'MONTHLY_FIXED' | 'CONTINUOUS'
  startDate:         string
  endDate?:          string
  contractDate:      string   // 계약 작성일

  // 근로시간
  checkInTime?:      string   // 'HH:MM'
  checkOutTime?:     string   // 'HH:MM'
  breakStartTime?:   string   // 'HH:MM'
  breakEndTime?:     string   // 'HH:MM'
  breakHours?:       number   // 시간 단위
  workDays?:         string   // '월~금' 등
  weeklyWorkDays?:   number   // 주 소정근로일
  weeklyWorkHours?:  number   // 주 소정근로시간

  // 휴일/연차
  holidayRule?:      string   // '일요일' 등
  annualLeaveRule?:  string   // 연차 적용 문구

  // 임금
  paymentMethod?:    string   // '현금' | '계좌이체'
  dailyWage?:        number
  monthlySalary?:    number
  paymentDay?:       number
  allowanceJson?:    { name: string; amount: number }[]  // 수당 항목

  // 수습
  probationYn?:      boolean
  probationMonths?:  number

  // 현장 특약
  attendanceVerificationMethod?: string
  workUnitRule?:     string
  rainDayRule?:      string
  siteStopRule?:     string
  siteChangeAllowed?: boolean

  // 용역/외주
  serviceFee?:       number
  businessRegistrationNo?: string
  contractorName?:   string

  // 보험
  nationalPensionYn:      boolean
  healthInsuranceYn:      boolean
  employmentInsuranceYn:  boolean
  industrialAccidentYn:   boolean
  retirementMutualYn:     boolean

  // 안전
  safetyClauseYn:    boolean

  // 특약
  specialTerms?:     string
}

export interface ContractSection {
  title: string
  content: string
}

export interface RenderedContract {
  templateType:  string
  title:         string
  subtitle:      string
  legalBasis:    string
  sections:      ContractSection[]
  signatureBlock: string
}

// ─── 공통 조항 빌더 ───────────────────────────────────────────

function insuranceClause(d: ContractData): string {
  const items: string[] = []
  if (d.nationalPensionYn)     items.push('국민연금')
  if (d.healthInsuranceYn)     items.push('건강보험')
  if (d.employmentInsuranceYn) items.push('고용보험')
  if (d.industrialAccidentYn)  items.push('산재보험')
  if (d.retirementMutualYn)    items.push('건설업 퇴직공제')

  return `① 사용자는 관계 법령에 따른 사회보험 가입 의무를 이행한다.
② 본 계약에 따른 4대보험 등 사회보험 적용은 다음과 같다.
   - 적용 항목: ${items.length ? items.join(', ') : '해당 없음 (법령 기준 확인 필요)'}
③ 국민연금, 건강보험, 고용보험, 산재보험의 적용 여부와 보험료 공제는 관계 법령 및 해당 월의 자격요건 충족 여부에 따라 처리하며, 당사자 합의만으로 법정 가입의무를 배제하지 않는다.
④ 고용보험은 일용근로자도 원칙적으로 적용 대상이며, 국민연금·건강보험은 월 근로일수·근로시간·소득 등 법정 기준 충족 시 적용된다.
${d.retirementMutualYn ? '⑤ 건설업 퇴직공제는 고용노동부 고시 기준에 따라 가입·신고한다.' : ''}`
}

function safetyClause(): string {
  return `① 사용자는 산업안전보건 관계 법령에 따라 근로자의 안전과 보건을 위하여 필요한 조치를 하고, 해당 작업에 필요한 안전보건교육을 실시한다.
② 근로자는 채용 시 교육, 작업내용 변경 시 교육 및 유해·위험작업에 필요한 특별교육 등 회사가 실시하는 안전보건교육에 성실히 참여하여야 한다.
③ 사용자는 작업에 필요한 보호구를 작업조건에 맞게 지급·관리하며, 근로자는 지급된 보호구를 올바르게 착용하고 안전수칙을 준수하여야 한다.
④ 근로자는 추락·낙하·붕괴·감전·화재 등 위험요인을 발견한 경우 즉시 관리감독자에게 보고하여야 한다.
⑤ 근로자는 산업재해가 발생할 급박한 위험이 있는 경우 작업을 중지하고 대피할 수 있으며, 즉시 관리감독자에게 보고하여야 한다. 사용자는 이를 이유로 해고나 그 밖의 불리한 처우를 하지 아니한다.
⑥ 근로자가 안전수칙을 중대하게 위반하거나 보호구 착용 지시를 반복적으로 따르지 않는 경우, 사용자는 관련 규정에 따라 재교육, 작업배치 제한, 현장출입 제한 등의 조치를 할 수 있다.
⑦ 본 조항은 산업안전보건 관계 법령에 따른 사용자의 법정 의무를 제한하거나 면제하는 것으로 해석되지 아니한다.`
}

function won(n?: number | null): string {
  return n != null ? n.toLocaleString('ko-KR') + '원' : '미정'
}

function dateStr(s?: string | null): string {
  return s || '무기한'
}

function timeRange(checkIn?: string, checkOut?: string, breakH?: number, breakS?: string, breakE?: string): string {
  const b = breakS && breakE ? `${breakS}~${breakE} (${breakH ?? 1}시간)` : `${breakH ?? 1}시간`
  return `시업 ${checkIn || '08:00'} / 종업 ${checkOut || '17:00'} / 휴게 ${b}`
}

// ─── 1. 일용직 근로계약서 ─────────────────────────────────────

export function renderDailyEmploymentContract(d: ContractData): RenderedContract {
  const sections: ContractSection[] = [
    {
      title: '제1조 (계약 당사자)',
      content: `사용자(이하 "갑")
  - 상호: ${d.companyName}
  - 대표자: ${d.companyCeo}
  - 사업자등록번호: ${d.companyBizNo || '             '}
  - 주소: ${d.companyAddress}

근로자(이하 "을")
  - 성명: ${d.workerName}
  - 생년월일: ${d.workerBirthDate || '             '}
  - 주소: ${d.workerAddress || '             '}
  - 연락처: ${d.workerPhone || '             '}`,
    },
    {
      title: '제2조 (취업 장소 및 담당 업무)',
      content: `① 취업 장소(현장명): ${d.siteName}
② 현장 주소: ${d.siteAddress || '             '}
③ 직종: ${d.jobTitle}
④ 담당 업무: ${d.taskDescription || d.jobTitle}`,
    },
    {
      title: '제3조 (근로계약 기간)',
      content: `① 계약 시작일: ${d.startDate}
② 계약 종료일: ${dateStr(d.endDate)}
${d.probationYn ? `③ 수습 기간: 입사일로부터 ${d.probationMonths || 3}개월\n④` : '③'} 일용직의 특성상 당일 출근한 경우에 한해 해당 일의 근로계약이 성립되며, 다음 날 이후의 취업은 보장하지 않는다.`,
    },
    {
      title: '제4조 (근로시간 및 휴게)',
      content: `① 1일 소정근로시간
  - 시업 시각: ${d.checkInTime || '08:00'}
  - 종업 시각: ${d.checkOutTime || '17:00'}
  - 휴게 시간: ${
    d.breakStartTime && d.breakEndTime
      ? `${d.breakStartTime} ~ ${d.breakEndTime} (${d.breakHours ?? 1}시간)`
      : d.breakHours != null ? `${d.breakHours}시간 (근로시간 중 부여)`
      : '1시간 (법정 기준)'
  }
② 주 소정근로일: ${d.weeklyWorkDays != null ? d.weeklyWorkDays + '일' : '현장 여건에 따름'}
③ 주 소정근로시간: ${d.weeklyWorkHours != null ? d.weeklyWorkHours + '시간' : '주 소정근로일 × 일 근로시간'}
④ 근무 요일: ${d.workDays || '현장 여건에 따름'}
⑤ 우천·공정 지연 등 불가피한 사유로 작업이 불가한 경우: ${d.rainDayRule || '별도 협의에 따른다.'}`,
    },
    {
      title: '제5조 (임금)',
      content: `① 임금 형태: 일당제
② 일당: ${won(d.dailyWage)}${
  d.allowanceJson && d.allowanceJson.length > 0
    ? '\n③ 수당:\n' + d.allowanceJson.map((a) => `  - ${a.name}: ${won(a.amount)}`).join('\n')
    : ''
}
${d.allowanceJson && d.allowanceJson.length > 0 ? '④' : '③'} 임금 계산 방법: 출근 1일당 일당 전액 지급. 반일 작업의 경우 현장 관리자 확인 하에 공수 비례 지급.
${d.allowanceJson && d.allowanceJson.length > 0 ? '⑤' : '④'} 지급일: 매월 ${d.paymentDay || '말일'} (해당 월 근무분)
${d.allowanceJson && d.allowanceJson.length > 0 ? '⑥' : '⑤'} 지급 방법: ${d.paymentMethod || '계좌이체'}
${d.allowanceJson && d.allowanceJson.length > 0 ? '⑦' : '⑥'} 임금의 구성: 기본 일당에는 주휴수당이 포함되지 아니한다. 주 15시간 이상 소정근로를 개근한 경우 주휴수당을 별도 산정한다.`,
    },
    {
      title: '제6조 (휴일 및 연차유급휴가)',
      content: `① 주휴일: ${d.holidayRule || '매주 일요일'}
② 법정 휴일: 근로자의 날(5월 1일) 및 관공서 공휴일에 관한 규정에 따른 공휴일을 법정휴일로 한다.
③ 연차유급휴가: ${d.annualLeaveRule || '근로기준법 제60조에 따라 1년간 80% 이상 출근한 근로자에게 15일의 유급휴가를 부여한다. 1년 미만 근무 또는 80% 미만 출근 시에는 1개월 개근 시 1일의 유급휴가를 부여한다.'}
④ 일용직의 특성상 연차유급휴가는 법령이 정하는 요건 충족 시 적용한다.`,
    },
    {
      title: '제7조 (출퇴근 확인 및 공수 산정)',
      content: `① 출퇴근 인증 방식: ${d.attendanceVerificationMethod || 'GPS 위치 기반 앱 인증'}
② 공수 인정 기준: ${d.workUnitRule || '출퇴근 기록, 작업기록, 현장확인에 따라 산정한다.'}
③ 허위 출퇴근 또는 대리 인증은 재심사 대상이 되며, 확인된 경우 공수에서 제외된다.
④ 작업중지 시 처리: ${d.siteStopRule || '관리자 지시에 따라 처리하며, 귀책 여부에 따라 임금을 산정한다.'}`,
    },
    {
      title: '제8조 (사회보험)',
      content: insuranceClause(d),
    },
    ...(d.safetyClauseYn ? [{
      title: '제9조 (안전보건 및 현장 준수사항)',
      content: safetyClause(),
    }] : []),
    {
      title: `제${d.safetyClauseYn ? 10 : 9}조 (계약서 교부)`,
      content: `"갑"은 본 계약 체결 즉시 본 계약서 사본을 "을"에게 교부한다(전자문서 포함). 계약서는 근로관계 종료 후 3년간 보존한다.`,
    },
    ...(d.specialTerms ? [{
      title: `제${d.safetyClauseYn ? 11 : 10}조 (특약사항)`,
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  'DAILY_EMPLOYMENT',
    title:         '일용 근로계약서',
    subtitle:      '(근로기준법 제17조·동법 시행령 제8조에 따른 필수사항 포함)',
    legalBasis:    '근로기준법 제17조, 동법 시행령 제8조, 산업안전보건법',
    sections,
    signatureBlock: `
위와 같이 근로계약을 체결하고, 계약서를 2부 작성하여 "갑"과 "을"이 각 1부씩 보관한다.

계약 체결일: ${d.contractDate}

사용자(갑)
  상호: ${d.companyName}
  대표자: ${d.companyCeo}   (서명 또는 인)

근로자(을)
  성명: ${d.workerName}   (서명 또는 인)
`,
  }
}

// ─── 2. 상용직/기간제 근로계약서 ─────────────────────────────

export function renderRegularEmploymentContract(d: ContractData, isFixedTerm = false): RenderedContract {
  const termDesc = isFixedTerm
    ? `① 계약 시작일: ${d.startDate}\n② 계약 종료일: ${dateStr(d.endDate)}\n③ 기간제 근로자로서 계약기간 만료 시 근로계약은 종료된다. 단, 별도 합의에 따라 갱신할 수 있다.`
    : `① 근로계약 기간: ${d.startDate}부터 기간의 정함 없이 계속 고용한다.`

  const sections: ContractSection[] = [
    {
      title: '제1조 (계약 당사자)',
      content: `사용자(이하 "갑")
  - 상호: ${d.companyName}
  - 대표자: ${d.companyCeo}
  - 주소: ${d.companyAddress}

근로자(이하 "을")
  - 성명: ${d.workerName}
  - 생년월일: ${d.workerBirthDate || '         '}
  - 주소: ${d.workerAddress || '         '}
  - 연락처: ${d.workerPhone || '         '}`,
    },
    {
      title: '제2조 (취업 장소 및 담당 업무)',
      content: `① 취업 장소(현장·부서): ${d.siteName}
② 현장·부서 주소: ${d.siteAddress || d.companyAddress}
③ 직종·직위: ${d.jobTitle}
④ 담당 업무: ${d.taskDescription || d.jobTitle}
⑤ "갑"은 업무상 필요한 경우 "을"의 동의 하에 근무 장소·담당 업무를 변경할 수 있다.`,
    },
    {
      title: '제3조 (근로계약 기간)',
      content: termDesc,
    },
    {
      title: '제4조 (근로시간·휴게·근무일)',
      content: `① 소정근로시간
  - 시업 시각: ${d.checkInTime || '09:00'}
  - 종업 시각: ${d.checkOutTime || '18:00'}
  - 휴게 시간: ${d.breakHours != null ? d.breakHours + '시간 (근로시간 중 부여)' : '1시간 (점심 포함)'}
② 근무 요일: ${d.workDays || '월요일~금요일 (주 5일)'}
③ 위 근로시간 외 연장근로는 근로자 동의 하에 시행하며 관계 법령에 따라 가산임금을 지급한다.`,
    },
    {
      title: '제5조 (임금)',
      content: `① 임금 형태: ${d.monthlySalary ? '월급제' : '일당제'}
${d.monthlySalary ? `② 기본급(월): ${won(d.monthlySalary)}` : `② 일당: ${won(d.dailyWage)}`}
③ 임금 구성항목: 기본급 (별도 수당이 있을 경우 급여대장에 별도 기재)
④ 지급일: 매월 ${d.paymentDay || '25'}일 (해당 월 근무분)
⑤ 지급 방법: ${d.paymentMethod || '계좌이체'}
⑥ 연장·야간·휴일 근로에 대해서는 근로기준법 제56조에 따라 통상임금의 50%를 가산하여 지급한다.`,
    },
    {
      title: '제6조 (휴일)',
      content: `① 주휴일: 일요일 (주 소정근로일을 개근한 경우 유급)
② 법정 공휴일: 관공서 공휴일에 관한 규정에 따른 공휴일 (유급)
③ 근로자의 날(5월 1일): 유급`,
    },
    {
      title: '제7조 (연차유급휴가)',
      content: `① 1년간 80% 이상 출근한 경우 15일의 유급휴가를 부여한다.
② 1년 미만 근무 또는 80% 미만 출근 시 1개월 개근 시 1일의 유급휴가를 부여한다.
③ 연차유급휴가는 근로기준법 제60조 내지 제62조에 따라 사용·보상한다.`,
    },
    {
      title: '제8조 (사회보험)',
      content: insuranceClause(d),
    },
    ...(d.safetyClauseYn ? [{
      title: '제9조 (안전보건 및 현장 준수사항)',
      content: safetyClause(),
    }] : []),
    {
      title: `제${d.safetyClauseYn ? 10 : 9}조 (취업규칙 등의 준수)`,
      content: `"을"은 "갑"의 취업규칙, 현장 안전수칙, 관련 내규를 준수하여야 한다. 본 계약에 정하지 않은 사항은 근로기준법 등 관계 법령 및 취업규칙에 따른다.`,
    },
    {
      title: `제${d.safetyClauseYn ? 11 : 10}조 (계약서 교부)`,
      content: `"갑"은 본 계약 체결 즉시 본 계약서 사본을 "을"에게 교부한다(전자문서 포함). 계약서는 근로관계 종료 후 3년간 보존한다.`,
    },
    ...(d.specialTerms ? [{
      title: `제${d.safetyClauseYn ? 12 : 11}조 (특약사항)`,
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  isFixedTerm ? 'FIXED_TERM_EMPLOYMENT' : 'REGULAR_EMPLOYMENT',
    title:         isFixedTerm ? '기간제 근로계약서' : '근로계약서 (상용직)',
    subtitle:      '(근로기준법 제17조·기간제법 제17조에 따른 필수사항 포함)',
    legalBasis:    '근로기준법 제17조, 기간제 및 단시간근로자 보호 등에 관한 법률 제17조, 산업안전보건법',
    sections,
    signatureBlock: `
위와 같이 근로계약을 체결하고, 계약서를 2부 작성하여 "갑"과 "을"이 각 1부씩 보관한다.

계약 체결일: ${d.contractDate}

사용자(갑)
  상호: ${d.companyName}
  대표자: ${d.companyCeo}   (서명 또는 인)

근로자(을)
  성명: ${d.workerName}   (서명 또는 인)
`,
  }
}

// ─── 3. 사업자 있는 외주팀 도급·용역계약서 ────────────────────

export function renderSubcontractBizContract(d: ContractData): RenderedContract {
  const sections: ContractSection[] = [
    {
      title: '제1조 (계약 당사자)',
      content: `도급인(이하 "갑")
  - 상호: ${d.companyName}
  - 대표자: ${d.companyCeo}
  - 주소: ${d.companyAddress}

수급인(이하 "을")
  - 상호: ${d.contractorName || '         '}
  - 대표자: ${d.workerName}
  - 사업자등록번호: ${d.businessRegistrationNo || '         '}
  - 주소: ${d.workerAddress || '         '}
  - 연락처: ${d.workerPhone || '         '}`,
    },
    {
      title: '제2조 (계약 목적 및 공정 범위)',
      content: `① 현장명: ${d.siteName}
② 현장 주소: ${d.siteAddress || '         '}
③ 계약 공정/업무 범위: ${d.taskDescription || d.jobTitle}
④ "을"은 위 공정·업무의 수행을 목적으로 본 계약을 체결하며, 계약 범위 외 업무는 별도 서면 합의 후 수행한다.`,
    },
    {
      title: '제3조 (계약 기간)',
      content: `① 계약 시작일: ${d.startDate}
② 계약 종료일: ${dateStr(d.endDate)}
③ 공정 진행 상황에 따라 쌍방 합의로 기간을 변경할 수 있다.`,
    },
    {
      title: '제4조 (계약 금액 및 정산)',
      content: `① 계약 금액: ${won(d.serviceFee)} (VAT 별도 또는 포함 여부: 별도 명시)
② 지급 방식: ${d.paymentMethod || '기성 정산 또는 완료 후 일괄 지급'}
③ 지급일: 매월 ${d.paymentDay || '말일'} 또는 기성 확인 후 [ ]일 이내
④ "을"이 제출하는 내부 인력배분 참고자료는 정산 참고 목적으로만 사용하며, "갑"이 각 개인의 임금 또는 사업소득 지급의무를 직접 부담하는 근거가 되지 아니한다.`,
    },
    {
      title: '제5조 (수급인의 독립적 수행 및 인력 운영)',
      content: `① "을"은 자기 책임과 계산으로 인력, 장비, 작업방법을 정하여 계약 목적물을 수행한다.
② "을" 소속 인력의 채용, 배치, 근태, 보수 지급, 세무 및 사회보험 관련 법정의무 이행은 원칙적으로 "을"의 책임으로 한다.
③ "갑"은 품질, 안전, 공정 및 결과물 확인 범위에서 협의·조정할 수 있으나, "을" 소속 인력에 대한 직접적인 인사·노무 지휘를 하지 않는다.
④ "을"은 적법한 고용관계 및 세무처리를 유지하여야 하며, 이를 위반하여 "갑"에게 손해가 발생한 경우 배상 책임을 진다.`,
    },
    {
      title: '제6조 (장비·자재 부담)',
      content: `① 작업 수행에 필요한 공구, 장비, 소모자재의 부담 주체는 별도 협의하여 계약에 명시한다.
② 현장 공통 안전시설 및 대형 장비는 "갑" 부담을 원칙으로 하며, 세부 사항은 별첨에 따른다.`,
    },
    {
      title: '제7조 (안전 및 법령 준수)',
      content: `① "을"은 산업안전보건법 등 관계 법령에 따른 안전보건 의무를 이행하여야 한다.
② "을"은 소속 인력에 대한 안전교육, 보호구 지급, 안전수칙 준수를 책임진다.
③ "갑"은 현장 전체 안전관리 체계를 유지하며, "을"의 작업이 현장 안전기준에 부합하도록 협력한다.
④ "을"의 부주의로 인한 산업재해에 대한 1차적 책임은 "을"이 부담한다.`,
    },
    {
      title: '제8조 (재하도급 제한)',
      content: `"을"은 "갑"의 서면 동의 없이 본 계약상 업무를 제3자에게 재위탁 또는 재하도급하지 못한다.`,
    },
    {
      title: '제9조 (계약 해지)',
      content: `① 다음 각 호의 사유 발생 시 "갑"은 즉시 계약을 해지할 수 있다.
  1. "을"이 정당한 사유 없이 공정을 지연하거나 중단한 경우
  2. "을"이 허위 자료를 제출하거나 부정한 방법으로 계약을 이행한 경우
  3. "을"이 안전수칙을 중대하게 위반하여 사고 위험을 야기한 경우
  4. 사업자등록 말소, 파산, 지급불능 등 계약 이행 불능 상태가 된 경우
② 해지 시 기성 정산은 실제 이행 부분에 대해 처리한다.`,
    },
    ...(d.specialTerms ? [{
      title: '제10조 (특약사항)',
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  'SUBCONTRACT_WITH_BIZ',
    title:         '도급·용역계약서',
    subtitle:      '(건설 현장 외주팀 — 사업자등록 있음)',
    legalBasis:    '민법, 건설산업기본법, 산업안전보건법, 하도급거래 공정화에 관한 법률',
    sections,
    signatureBlock: `
위와 같이 도급·용역계약을 체결하고, 계약서를 2부 작성하여 "갑"과 "을"이 각 1부씩 보관한다.

계약 체결일: ${d.contractDate}

도급인(갑)
  상호: ${d.companyName}
  대표자: ${d.companyCeo}   (서명 또는 인)

수급인(을)
  상호: ${d.contractorName || '         '}
  대표자: ${d.workerName}   (서명 또는 인)
  사업자등록번호: ${d.businessRegistrationNo || '         '}
`,
  }
}

// ─── 4. 사업자 없는 팀장형 서면 세트 ─────────────────────────

export function renderNonbizTeamReviewDocs(d: ContractData): RenderedContract {
  const sections: ContractSection[] = [
    {
      title: '제1조 (서면 목적 및 법적 성격)',
      content: `① 본 서면은 팀장(이하 "팀장")이 공정 수행에 관한 책임 범위와 제출 자료를 확인하기 위한 것이다.
② 본 서면은 팀장 또는 소속 인력과 "${d.companyName}"(이하 "회사") 사이의 근로계약, 파견계약, 도급계약을 구성하지 아니한다.
③ 실제 운영 구조가 회사가 직접 지휘·감독하고 개인별로 임금을 지급하는 직접고용 구조에 해당하는 경우, 이 서면은 그 효력이 없으며 해당 인력은 개별 근로계약 대상으로 재분류한다.`,
    },
    {
      title: '제2조 (팀장 정보)',
      content: `- 팀장 성명: ${d.workerName}
- 연락처: ${d.workerPhone || '         '}
- 현장명: ${d.siteName}
- 담당 공정/업무: ${d.taskDescription || d.jobTitle}`,
    },
    {
      title: '제3조 (공정 수행 기간)',
      content: `- 시작일: ${d.startDate}
- 종료(예정)일: ${dateStr(d.endDate)}`,
    },
    {
      title: '제4조 (인력 운영 책임 확인)',
      content: `팀장은 다음 사항을 확인하고 서명한다.
① 본 팀의 인력 구성, 배치, 작업 방법에 관한 1차적 결정은 팀장이 한다.
② 팀 내 인력에 대한 보수 배분은 팀 내부 규칙에 따라 팀장이 책임지고 처리한다.
③ 팀장은 소속 인력에 관한 세무 처리(원천징수 등 법령상 의무 해당 시)를 별도로 이행한다.
④ 팀장은 회사가 해당 인력의 4대보험, 세금을 임의로 미적용·미납하도록 강요하지 않았음을 확인한다.`,
    },
    {
      title: '제5조 (4대보험 적용 원칙)',
      content: `① 본 서면만으로 소속 인력의 4대보험 가입의무를 배제하지 아니한다.
② 실제 법률관계가 근로자에 해당하는 경우, 관계 법령에 따라 사회보험 가입 및 공제를 처리하여야 한다.
③ 팀장 또는 소속 인력이 사회보험 가입을 원하지 아니한다는 의사를 표시하더라도, 관계 법령상 가입 대상에 해당하는 경우에는 법령에 따라 처리한다.`,
    },
    {
      title: '제6조 (안전 책임)',
      content: `① 팀장은 소속 인력에게 현장 안전수칙을 교육하고, 보호구 착용을 지도할 책임이 있다.
② 회사는 현장 전체 안전관리 체계를 유지하며, 팀장과 협력하여 안전사고를 예방한다.
③ 산업재해가 발생할 급박한 위험이 있는 경우 작업을 중지하고 즉시 회사 현장관리자에게 보고하여야 한다.`,
    },
    {
      title: '제7조 (내부 인력배분 참고자료)',
      content: `팀장이 제출하는 인력배분 참고자료(인원 수, 배분 비율 등)는 기성 정산을 위한 참고 목적으로만 사용하며, 회사가 각 개인에 대한 임금 지급의무를 부담한다는 의미가 아니다.`,
    },
    {
      title: '⚠ 검토 필요 사항 (관리자 확인)',
      content: `본 서면은 [검토 필요(REVIEW_REQUIRED)] 상태로 등록됩니다.

관리자는 다음 사항을 반드시 점검하여야 합니다.
□ 회사가 소속 인력의 출퇴근을 직접 관리하는가?
□ 회사가 개인별 일당·금액을 직접 결정하는가?
□ 회사가 개인별로 직접 송금하는가?
□ 회사 관리자가 작업 지시·패널티를 개인에게 직접 행사하는가?

위 항목 중 하나라도 해당하면 → 개별 근로계약으로 재분류 필요`,
    },
    ...(d.specialTerms ? [{
      title: '제8조 (특이사항)',
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  'NONBUSINESS_TEAM_REVIEW',
    title:         '팀장 책임확인서 (공정수행 서면 세트)',
    subtitle:      '⚠ 사업자등록 없는 팀장형 — 법적 검토 필요 상태로 등록됨',
    legalBasis:    '근로기준법, 파견근로자 보호 등에 관한 법률, 국민연금법, 고용보험법, 산업안전보건법',
    sections,
    signatureBlock: `
위 사항을 확인하고 서명합니다.

작성일: ${d.contractDate}

회사 확인
  상호: ${d.companyName}
  담당자:    (서명 또는 인)

팀장 확인
  성명: ${d.workerName}   (서명 또는 인)

* 본 서면은 관리자 검토 완료 후 최종 효력이 발생합니다.
`,
  }
}

// ─── 5. 월단위 기간제 근로계약서 ─────────────────────────────

export function renderMonthlyFixedContract(d: ContractData): RenderedContract {
  const halfDay = d.dailyWage ? Math.floor(d.dailyWage * 0.5) : 0
  // compute actual work hours
  let actualHours = 8
  if (d.checkInTime && d.checkOutTime) {
    const [ih, im] = d.checkInTime.split(':').map(Number)
    const [oh, om] = d.checkOutTime.split(':').map(Number)
    const total = (oh * 60 + om) - (ih * 60 + im)
    actualHours = Math.max(1, (total - (d.breakHours ?? 1) * 60) / 60)
  }
  const hourlyRef = d.dailyWage ? Math.floor(d.dailyWage / actualHours) : 0

  const header = `[공사 및 현장 정보]
공사명:   ${d.projectName || '             '}
현장명:   ${d.siteName}
현장주소: ${d.siteAddress || '             '}
공종:     ${d.workType || '             '}${d.workTypeSub ? ` / ${d.workTypeSub}` : ''}
직종:     ${d.jobCategory || d.jobTitle}${d.jobCategorySub ? ` / ${d.jobCategorySub}` : ''}
담당업무: ${d.taskDescription || d.jobTitle}`

  const sections: ContractSection[] = [
    {
      title: '제1조(목적)',
      content: `본 계약은 회사가 수행하는 건설현장에서 근로자가 일정 기간 동안 제공하는 노무의 조건을 정함을 목적으로 한다.`,
    },
    {
      title: '제2조(당사자)',
      content: `① 사용자
  - 회사명: ${d.companyName}
  - 사업자등록번호: ${d.companyBizNo || '             '}
  - 대표자: ${d.companyCeo}
  - 주소: ${d.companyAddress}

② 근로자
  - 성명: ${d.workerName}
  - 생년월일: ${d.workerBirthDate || '             '}
  - 주소: ${d.workerAddress || '             '}
  - 연락처: ${d.workerPhone || '             '}`,
    },
    {
      title: '제3조(근무장소 및 공사 내용)',
      content: `① 근무장소는 ${d.siteAddress || d.siteName}로 한다.
② 공사명은 [${d.projectName || d.siteName}], 현장명은 [${d.siteName}]으로 한다.
③ 공종은 [${d.workType || '            '}], 세부공종은 [${d.workTypeSub || '            '}]으로 한다.`,
    },
    {
      title: '제4조(직종 및 담당업무)',
      content: `① 근로자의 직종은 [${d.jobCategory || d.jobTitle}], 세부직종은 [${d.jobCategorySub || '            '}]으로 한다.
② 담당업무는 [${d.taskDescription || d.jobTitle}]로 한다.
③ 회사는 공정 진행, 작업물량, 안전상 필요가 있는 경우 동일 공종 범위 내에서 담당업무의 세부 내용을 합리적으로 조정할 수 있다.`,
    },
    {
      title: '제5조(계약형태 및 계약기간)',
      content: `① 본 계약은 월단위 기간제 근로계약으로 한다.
② 계약기간은 ${d.startDate}부터 ${dateStr(d.endDate)}까지로 한다.
③ 계약기간이 만료되면 본 계약은 종료된다.
④ 계약 갱신 여부는 공사물량, 현장상황, 근무성실도, 안전수칙 준수 여부 등을 종합하여 회사가 판단한다.`,
    },
    {
      title: '제6조(근무일 및 근로시간)',
      content: `① 근무일은 회사가 지정한 작업일로 한다.
② 1일 근로시간은 다음과 같다.
  - 출근시간: ${d.checkInTime || '08:00'}
  - 퇴근시간: ${d.checkOutTime || '17:00'}
③ 휴게시간은 다음과 같다.
  - 휴게시작: ${d.breakStartTime || '12:00'}
  - 휴게종료: ${d.breakEndTime || '13:00'}
  - 총 휴게시간: ${d.breakHours ?? 1}시간
④ 실제 근무일과 근무시간은 기상, 공정, 발주처 요청, 현장여건 및 안전상 필요에 따라 관계 법령 범위 내에서 조정될 수 있다.`,
    },
    {
      title: '제7조(출퇴근 인증방식)',
      content: `① 출퇴근 확인 방식은 [${d.attendanceVerificationMethod || 'GPS 위치 기반 앱 인증'}]으로 한다.
② 회사는 전자출퇴근기록, 관리자 확인, 작업일보, 기타 운영기록을 종합하여 출근 여부와 근로 제공 여부를 확인할 수 있다.`,
    },
    {
      title: '제8조(임금)',
      content: `① 근로자의 1일 일당은 ${won(d.dailyWage)}으로 한다.
② 반공수 참고액은 ${won(halfDay)}으로 한다.
③ 시간환산 참고액은 ${won(hourlyRef)}/시간으로 한다.
④ 제2항 및 제3항의 금액은 운영상 참고를 위한 값이며, 실제 임금정산은 관계 법령과 실제 근로내역에 따라 처리한다.
⑤ 임금은 매월 ${d.paymentDay || '말일'}일에 근로자 명의 계좌로 지급한다.
⑥ 지급 방법: ${d.paymentMethod || '계좌이체'}`,
    },
    {
      title: '제9조(공수 산정 및 출근 인정)',
      content: `① 공수는 회사가 정한 공수기준에 따라 산정한다.
② 공수기준은 다음과 같다.
  ${d.workUnitRule || '출퇴근 기록, 작업기록, 현장확인에 따라 산정한다.'}
③ 회사는 전자출퇴근기록, 작업일보, 현장관리자 확인, 실제 근로시간 등을 종합하여 공수를 확정한다.
④ 무단결근, 무단이탈, 허위 출근기록, 중대한 안전수칙 위반은 공수 불인정 또는 감액 사유가 될 수 있다.`,
    },
    {
      title: '제10조(우천 및 작업중단 처리)',
      content: `우천, 강풍, 발주처 사정, 공정 중단, 안전상 사유 등으로 작업이 중단되는 경우의 처리기준은 다음과 같다.
  ${d.rainDayRule || '현장 관리자 지시에 따라 처리하며, 귀책 여부에 따라 임금을 산정한다.'}`,
    },
    {
      title: '제11조(휴일, 휴가 및 법정수당)',
      content: `① 휴일, 휴가, 연차유급휴가, 주휴일, 근로자의 날 등은 관계 법령에 따른다.
② 연장근로수당, 야간근로수당, 휴일근로수당은 관계 법령 및 실제 발생한 근로내역에 따라 별도로 산정한다.
③ 주휴, 연차, 퇴직금 등은 계약서 형식만으로 일률 판단하지 아니하고 관계 법령 및 실제 근로형태와 근로내역에 따라 판단한다.`,
    },
    {
      title: '제12조(퇴직급여 및 사회보험)',
      content: `① 퇴직금은 관계 법령상 지급요건 충족 시 지급한다.
② 사회보험(${[
  d.nationalPensionYn ? '국민연금' : null,
  d.healthInsuranceYn ? '건강보험' : null,
  d.employmentInsuranceYn ? '고용보험' : null,
  d.industrialAccidentYn ? '산재보험' : null,
  d.retirementMutualYn ? '건설업 퇴직공제' : null,
].filter(Boolean).join(', ') || '관계 법령 기준'}) 및 세무처리는 관계 법령에 따라 적용 또는 신고·공제한다.`,
    },
    {
      title: '제13조(안전 및 보호구)',
      content: `① 회사는 작업내용과 위험요인에 적합한 보호구를 지급할 수 있으며, 근로자는 이를 착용하여야 한다.
② 근로자는 안전모, 안전화, 안전조끼 등 기본 보호구를 착용하여야 하고, 작업유형에 따라 보안경, 안전대, 방진마스크, 귀마개, 각반 등 추가 보호구를 착용하여야 한다.
③ 근로자는 보호구를 임의로 미착용, 훼손, 방치하여서는 아니 된다.`,
    },
    {
      title: '제14조(복무 및 준수사항)',
      content: `① 근로자는 회사의 작업지시, 현장규정 및 안전수칙을 준수하여야 한다.
② 다음 행위는 중대한 위반행위가 될 수 있다.
  - 음주 후 작업
  - 무단결근 및 무단이탈
  - 보호구 미착용
  - 허위 출퇴근기록
  - 정당한 작업지시 불이행`,
    },
    {
      title: '제15조(근로조건 설명 및 계약서 교부)',
      content: `① 회사는 본 계약의 주요 내용을 근로자에게 설명한다.
② 회사는 본 계약서 1부를 근로자에게 교부한다.
③ 근로자는 계약조건 설명을 듣고 계약서 1부를 수령하였음을 확인한다.`,
    },
    {
      title: '제16조(기타)',
      content: `본 계약에 정하지 아니한 사항은 근로기준법, 산업안전보건 관련 법령, 근로자퇴직급여 관련 법령, 기간제 근로 관련 법령 등 관계 법령에 따른다.`,
    },
    ...(d.specialTerms ? [{
      title: '제17조(특약사항)',
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  'MONTHLY_FIXED_EMPLOYMENT',
    title:         '건설현장 월단위 기간제 근로계약서',
    subtitle:      header,
    legalBasis:    '근로기준법 제17조, 기간제 및 단시간근로자 보호 등에 관한 법률 제17조, 산업안전보건법',
    sections,
    signatureBlock: `
위와 같이 근로계약을 체결하고, 본 계약서 1부를 근로자에게 교부하였음을 확인한다.

계약 체결일: ${d.contractDate}

사용자(회사)
  회사명: ${d.companyName}
  대표자 또는 대리인: __________________ (서명 또는 인)

근로자
  성명: ${d.workerName}   __________________ (서명 또는 인)
`,
  }
}

// ─── 6. 계속근로형 근로계약서 ─────────────────────────────────

export function renderContinuousContract(d: ContractData): RenderedContract {
  const halfDay = d.dailyWage ? Math.floor(d.dailyWage * 0.5) : 0
  let actualHours = 8
  if (d.checkInTime && d.checkOutTime) {
    const [ih, im] = d.checkInTime.split(':').map(Number)
    const [oh, om] = d.checkOutTime.split(':').map(Number)
    const total = (oh * 60 + om) - (ih * 60 + im)
    actualHours = Math.max(1, (total - (d.breakHours ?? 1) * 60) / 60)
  }
  const hourlyRef = d.dailyWage ? Math.floor(d.dailyWage / actualHours) : 0

  const header = `[공사 및 현장 정보]
공사명:   ${d.projectName || '             '}
현장명:   ${d.siteName}
현장주소: ${d.siteAddress || '             '}
공종:     ${d.workType || '             '}${d.workTypeSub ? ` / ${d.workTypeSub}` : ''}
직종:     ${d.jobCategory || d.jobTitle}${d.jobCategorySub ? ` / ${d.jobCategorySub}` : ''}
담당업무: ${d.taskDescription || d.jobTitle}`

  const sections: ContractSection[] = [
    {
      title: '제1조(목적)',
      content: `본 계약은 회사가 수행하는 건설현장에서 근로자가 제공하는 노무의 조건을 정함을 목적으로 한다.`,
    },
    {
      title: '제2조(당사자)',
      content: `① 사용자
  - 회사명: ${d.companyName}
  - 사업자등록번호: ${d.companyBizNo || '             '}
  - 대표자: ${d.companyCeo}
  - 주소: ${d.companyAddress}

② 근로자
  - 성명: ${d.workerName}
  - 생년월일: ${d.workerBirthDate || '             '}
  - 주소: ${d.workerAddress || '             '}
  - 연락처: ${d.workerPhone || '             '}`,
    },
    {
      title: '제3조(근무장소 및 공사 내용)',
      content: `① 근무장소는 ${d.siteAddress || d.siteName}로 한다.
② 공사명은 [${d.projectName || d.siteName}], 현장명은 [${d.siteName}]으로 한다.
③ 공종은 [${d.workType || '            '}], 세부공종은 [${d.workTypeSub || '            '}]으로 한다.`,
    },
    {
      title: '제4조(직종 및 담당업무)',
      content: `① 근로자의 직종은 [${d.jobCategory || d.jobTitle}], 세부직종은 [${d.jobCategorySub || '            '}]으로 한다.
② 담당업무는 [${d.taskDescription || d.jobTitle}]로 한다.
③ 회사는 공정 진행, 작업물량, 안전상 필요가 있는 경우 동일 공종 범위 내에서 담당업무의 세부 내용을 합리적으로 조정할 수 있다.`,
    },
    {
      title: '제5조(계약형태 및 계약기간)',
      content: `① 본 계약은 기간의 정함이 없는 계속근로형 근로계약으로 한다.
② 계약개시일은 ${d.startDate}로 한다.
③ 본 계약의 종료는 관계 법령, 회사 규정 및 본 계약에 따른다.`,
    },
    {
      title: '제6조(근무일 및 근로시간)',
      content: `① 근무일은 회사가 지정한 작업일로 한다.
② 1일 근로시간은 다음과 같다.
  - 출근시간: ${d.checkInTime || '08:00'}
  - 퇴근시간: ${d.checkOutTime || '17:00'}
③ 휴게시간은 다음과 같다.
  - 휴게시작: ${d.breakStartTime || '12:00'}
  - 휴게종료: ${d.breakEndTime || '13:00'}
  - 총 휴게시간: ${d.breakHours ?? 1}시간
④ 실제 근무일과 근무시간은 기상, 공정, 발주처 요청, 현장여건 및 안전상 필요에 따라 관계 법령 범위 내에서 조정될 수 있다.
⑤ 위 근로시간 외 연장근로는 근로자 동의 하에 시행하며 관계 법령에 따라 가산임금을 지급한다.`,
    },
    {
      title: '제7조(출퇴근 인증방식)',
      content: `① 출퇴근 확인 방식은 [${d.attendanceVerificationMethod || 'GPS 위치 기반 앱 인증'}]으로 한다.
② 회사는 전자출퇴근기록, 관리자 확인, 작업일보, 기타 운영기록을 종합하여 출근 여부와 근로 제공 여부를 확인할 수 있다.`,
    },
    {
      title: '제8조(임금)',
      content: `① 근로자의 1일 일당은 ${won(d.dailyWage)}으로 한다.
② 반공수 참고액은 ${won(halfDay)}으로 한다.
③ 시간환산 참고액은 ${won(hourlyRef)}/시간으로 한다.
④ 제2항 및 제3항의 금액은 운영상 참고를 위한 값이며, 실제 임금정산은 관계 법령과 실제 근로내역에 따라 처리한다.
⑤ 임금은 매월 ${d.paymentDay || '말일'}일에 근로자 명의 계좌로 지급한다.
⑥ 지급 방법: ${d.paymentMethod || '계좌이체'}`,
    },
    {
      title: '제9조(공수 산정 및 출근 인정)',
      content: `① 공수는 회사가 정한 공수기준에 따라 산정한다.
② 공수기준은 다음과 같다.
  ${d.workUnitRule || '출퇴근 기록, 작업기록, 현장확인에 따라 산정한다.'}
③ 회사는 전자출퇴근기록, 작업일보, 현장관리자 확인, 실제 근로시간 등을 종합하여 공수를 확정한다.
④ 무단결근, 무단이탈, 허위 출근기록, 중대한 안전수칙 위반은 공수 불인정 또는 감액 사유가 될 수 있다.`,
    },
    {
      title: '제10조(우천 및 작업중단 처리)',
      content: `우천, 강풍, 발주처 사정, 공정 중단, 안전상 사유 등으로 작업이 중단되는 경우의 처리기준은 다음과 같다.
  ${d.rainDayRule || '현장 관리자 지시에 따라 처리하며, 귀책 여부에 따라 임금을 산정한다.'}`,
    },
    {
      title: '제11조(휴일, 휴가 및 법정수당)',
      content: `① 주휴일: 매주 일요일 (주 소정근로일 개근 시 유급)
② 법정 공휴일 및 근로자의 날은 관계 법령에 따른다.
③ 연차유급휴가: 근로기준법 제60조에 따른다.
④ 연장·야간·휴일근로수당은 관계 법령 및 실제 발생한 근로내역에 따라 별도로 산정한다.`,
    },
    {
      title: '제12조(퇴직급여 및 사회보험)',
      content: `① 퇴직금은 관계 법령상 지급요건 충족 시 지급한다.
② 사회보험(${[
  d.nationalPensionYn ? '국민연금' : null,
  d.healthInsuranceYn ? '건강보험' : null,
  d.employmentInsuranceYn ? '고용보험' : null,
  d.industrialAccidentYn ? '산재보험' : null,
  d.retirementMutualYn ? '건설업 퇴직공제' : null,
].filter(Boolean).join(', ') || '관계 법령 기준'}) 및 세무처리는 관계 법령에 따라 적용 또는 신고·공제한다.`,
    },
    {
      title: '제13조(안전 및 보호구)',
      content: `① 회사는 작업내용과 위험요인에 적합한 보호구를 지급할 수 있으며, 근로자는 이를 착용하여야 한다.
② 근로자는 안전모, 안전화, 안전조끼 등 기본 보호구를 착용하여야 하고, 작업유형에 따라 보안경, 안전대, 방진마스크, 귀마개, 각반 등 추가 보호구를 착용하여야 한다.
③ 근로자는 보호구를 임의로 미착용, 훼손, 방치하여서는 아니 된다.`,
    },
    {
      title: '제14조(복무 및 준수사항)',
      content: `① 근로자는 회사의 작업지시, 현장규정 및 안전수칙을 준수하여야 한다.
② 다음 행위는 중대한 위반행위가 될 수 있다.
  - 음주 후 작업
  - 무단결근 및 무단이탈
  - 보호구 미착용
  - 허위 출퇴근기록
  - 정당한 작업지시 불이행`,
    },
    {
      title: '제15조(근로조건 설명 및 계약서 교부)',
      content: `① 회사는 본 계약의 주요 내용을 근로자에게 설명한다.
② 회사는 본 계약서 1부를 근로자에게 교부한다.
③ 근로자는 계약조건 설명을 듣고 계약서 1부를 수령하였음을 확인한다.`,
    },
    {
      title: '제16조(기타)',
      content: `본 계약에 정하지 아니한 사항은 근로기준법, 산업안전보건 관련 법령, 근로자퇴직급여 관련 법령 등 관계 법령에 따른다.`,
    },
    ...(d.specialTerms ? [{
      title: '제17조(특약사항)',
      content: d.specialTerms,
    }] : []),
  ]

  return {
    templateType:  'CONTINUOUS_EMPLOYMENT',
    title:         '건설현장 계속근로형 근로계약서',
    subtitle:      header,
    legalBasis:    '근로기준법 제17조, 동법 시행령 제8조, 산업안전보건법',
    sections,
    signatureBlock: `
위와 같이 근로계약을 체결하고, 본 계약서 1부를 근로자에게 교부하였음을 확인한다.

계약 체결일: ${d.contractDate}

사용자(회사)
  회사명: ${d.companyName}
  대표자 또는 대리인: __________________ (서명 또는 인)

근로자
  성명: ${d.workerName}   __________________ (서명 또는 인)
`,
  }
}

// ─── 통합 렌더러 ──────────────────────────────────────────────

export function renderContract(templateType: string, data: ContractData): RenderedContract {
  switch (templateType) {
    case 'DAILY_EMPLOYMENT':           return renderDailyEmploymentContract(data)
    case 'MONTHLY_FIXED_EMPLOYMENT':   return renderMonthlyFixedContract(data)
    case 'CONTINUOUS_EMPLOYMENT':      return renderContinuousContract(data)
    case 'REGULAR_EMPLOYMENT':         return renderRegularEmploymentContract(data, false)
    case 'FIXED_TERM_EMPLOYMENT':      return renderRegularEmploymentContract(data, true)
    case 'OFFICE_SERVICE':             return renderRegularEmploymentContract(data, false)
    case 'FREELANCER_SERVICE':         return renderSubcontractBizContract(data)
    case 'SUBCONTRACT_WITH_BIZ':       return renderSubcontractBizContract(data)
    case 'NONBUSINESS_TEAM_REVIEW':    return renderNonbizTeamReviewDocs(data)
    default:                           return renderDailyEmploymentContract(data)
  }
}

// 계약서 전문 텍스트 변환 (HTML 미지원 환경용)
export function contractToText(contract: RenderedContract): string {
  const lines: string[] = [
    contract.title,
    contract.subtitle,
    '',
    `[법적 근거] ${contract.legalBasis}`,
    '',
    '━'.repeat(50),
    '',
  ]
  for (const s of contract.sections) {
    lines.push(s.title)
    lines.push(s.content)
    lines.push('')
  }
  lines.push('━'.repeat(50))
  lines.push(contract.signatureBlock)
  return lines.join('\n')
}
