/**
 * labor-faq/seed-data.ts
 *
 * 1차 FAQ 등록 데이터 22개.
 * 모든 답변은 고용노동부/생활법령정보 공식 기준 기반.
 * AI가 임의 생성한 내용 없음 — 승인된 데이터만 사용.
 *
 * 기준일: 2026-03-23
 */

import type { FaqCategory, FaqStatus, TriggerCondition } from './types'

export interface FaqSeedItem {
  id: string
  category: FaqCategory
  question: string
  questionAliases: string[]
  shortAnswer: string
  fullAnswer: string
  appRule: string
  caution: string
  sourceOrg: string
  sourceTitle: string
  sourceUrl: string
  effectiveDate: string
  relatedContractTypes: string[]
  triggerConditions: TriggerCondition[]
  priority: number
  status: FaqStatus
  isActive: boolean
}

export const FAQ_SEED_DATA: FaqSeedItem[] = [

  // ── A. 계약유형 구분 ──────────────────────────────────────────────────────

  {
    id: 'faq_0001',
    category: 'CONTRACT_TYPE',
    question: '일용직과 상용직의 차이는 무엇인가?',
    questionAliases: [
      '일용직이랑 상용직 차이가 뭐예요',
      '일용직 상용직 어떻게 달라요',
      '일용직이랑 정규직 차이',
      '하루 일당이면 일용직인가요',
      '일용직과 상용직 구분 기준',
    ],
    shortAnswer: '일용직은 보통 1개월 미만 단기 고용, 상용직은 1개월 이상 또는 계속근무형 고용으로 봅니다.',
    fullAnswer: `고용노동부 FAQ는 일용근로자를 1개월 미만 고용되는 사람으로 설명합니다. 임금을 일당으로 계산하더라도 근로계약기간이 1개월 이상이면 일용이 아니라 상용근로자라고 안내합니다.

판단 기준:
• 1개월 미만 단기·일단위 호출형 → 일용직 검토
• 1개월 이상 또는 계속근무 예정 → 상용직 또는 기간제 검토
• 종료일 없음 → 상용직 우선 검토

핵심: 임금이 일당이어도 고용기간이 1개월 이상이면 상용근로자입니다.`,
    appRule: '1개월 미만 단기·일단위 호출형이면 일용직, 1개월 이상 계속근무 예정이면 상용직 또는 기간제 검토를 유도합니다. 일용직 계약서에 계속 고용 보장 문구는 넣지 않습니다.',
    caution: '실제 판단은 임금 형태보다 고용기간과 계속근무 여부가 더 중요합니다. 같은 사람을 반복 등록하는 경우 계속근로 가능성을 같이 봐야 합니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조 (근로자, 사용자, 근로계약 정의)',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'DAILY_EMPLOYMENT' },
    ],
    priority: 95,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0002',
    category: 'CONTRACT_TYPE',
    question: '기간제와 상용직의 차이는 무엇인가?',
    questionAliases: [
      '기간제랑 상용직 차이',
      '계약직이랑 상용직 뭐가 달라요',
      '종료일 있으면 기간제인가요',
      '상용직은 종료일이 없나요',
      '기간제 선택 기준 알려줘',
      '기간제가 뭔가요',
    ],
    shortAnswer: '기간제는 시작일과 종료일이 정해진 계약, 상용직은 종료일 없이 계속 재직하는 계약입니다.',
    fullAnswer: `생활법령정보는 기간제근로자를 근로기간이 정해져 있는 근로계약을 체결한 근로자로 설명합니다. 고용노동부 표준근로계약서 작성방법은 기간을 정하지 않는 경우 근로개시일만 기재하도록 안내합니다.

핵심 차이:
• 기간제: 계약서에 시작일·종료일 명시 필수. 기간만료 시 자동 종료.
• 상용직: 종료일 없음. 퇴직·해고 전까지 근로관계 유지.
• 2년 초과 주의: 동일 업무 기간제 2년 초과 사용 시 무기계약 전환 의무 발생.

앱 처리 기준:
• 시작일과 종료일 모두 있음 → 기간제 우선 검토
• 종료일 없음 → 상용직 우선 검토
• 종료일이 있는데 상용직 선택 시 경고 노출`,
    appRule: '기간제 계약서는 종료일 미입력 시 생성이 차단됩니다. 상용직 계약서 생성 시 종료일이 입력되어 있으면 기간제 검토 경고를 표시합니다.',
    caution: '종료일이 형식상만 있는지, 실제로 그 기간 동안만 일하는지 확인해야 합니다. 기간제법 제4조: 2년 초과 사용 시 무기계약 전환 의무.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'FIXED_TERM_EMPLOYMENT' },
      { context: 'CONTRACT_CREATE', field: 'endDate', op: 'exists' },
    ],
    priority: 95,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0003',
    category: 'CONTRACT_TYPE',
    question: '종료일이 없으면 어떤 계약을 선택해야 하나?',
    questionAliases: [
      '종료일 없으면 어떤 계약이에요',
      '끝날 날짜가 없으면',
      '언제까지 일할지 모르면',
      '무기한 근무 계약',
      '종료일 없이 쭉 쓰려면',
      '퇴사 날짜 안 정하면 어떤 계약',
    ],
    shortAnswer: '종료일이 없고 계속 근무할 예정이면 상용직 검토가 맞습니다.',
    fullAnswer: `고용노동부 표준근로계약서 작성방법은 근로계약기간을 정하지 않는 경우 근로개시일만 기재하도록 합니다. 따라서 종료일 없이 계속근무 전제로 계약하려면 기간제보다 상용직 구조가 맞습니다.

앱 처리 기준:
• 종료일 없음 + 계속근무 → 상용직 추천
• 종료일 없음 + 일용직 선택 → 경고
• 종료일 없는 기간제 생성 시 차단`,
    appRule: '앱에서 상용직 계약서 생성 시 종료일을 입력하면 경고가 표시됩니다. 종료일이 있다면 기간제 검토를 유도합니다.',
    caution: '단기 호출형인데 종료일만 비워두는 방식은 오선택 위험이 큽니다. 종료일이 확정된 경우에만 기간제를 선택하세요.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조 (근로조건의 명시)',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_CREATE', field: 'endDate', op: 'notExists' },
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'FIXED_TERM_EMPLOYMENT' },
    ],
    priority: 90,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0004',
    category: 'CONTRACT_TYPE',
    question: '종료일이 있으면 어떤 계약을 선택해야 하나?',
    questionAliases: [
      '종료일 있으면 기간제인가요',
      '끝나는 날이 정해졌어요',
      '몇 월 몇 일까지만 일해요',
      '계약 만료일이 있어요',
      '특정 기간만 일할 건데',
    ],
    shortAnswer: '종료일이 명확하면 기간제 검토가 우선입니다.',
    fullAnswer: `기간제는 근로기간이 정해진 계약입니다. 시작일과 종료일이 이미 정해져 있다면 상용직보다 기간제 문서가 구조상 맞습니다.

기간제 선택이 적합한 상황:
• 특정 프로젝트 종료일까지만 근무하는 경우
• 출산·육아휴직 대체 인원
• 정해진 시즌 또는 공기(工期)에 맞춘 계약

앱 처리 기준:
• 종료일 입력됨 → 기간제 FAQ 자동 추천
• 상용직 선택 + 종료일 입력 → 경고 표시
• 기간제 생성 시 종료일 필수`,
    appRule: '기간제 계약서 생성 시 종료일 미입력이면 생성이 차단됩니다. 종료일이 시작일보다 빠르면 입력 오류로 차단됩니다.',
    caution: '형식상 종료일을 넣었더라도 매달 반복 갱신 구조라면 계속근로 검토가 필요할 수 있습니다. 누적 계약기간을 관리하세요.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_CREATE', field: 'endDate', op: 'exists' },
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'REGULAR_EMPLOYMENT' },
    ],
    priority: 90,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0005',
    category: 'REGULAR_EMPLOYMENT',
    question: '정규직은 상용직과 같은가?',
    questionAliases: [
      '정규직이랑 상용직 같은 건가요',
      '정규직도 상용직 계약서 쓰나요',
      '정규직은 어떤 계약서 써요',
      '상용직이 정규직인가요',
      '정규직 계약서 따로 있나요',
    ],
    shortAnswer: '앱에서는 정규직을 별도 문서로 만들지 않고 상용직에 포함해 처리합니다.',
    fullAnswer: `법률상 "정규직"이라는 별도 용어는 없습니다. 실무에서는 정규직이라는 표현을 많이 쓰지만, 계약서 구조상 기간의 정함이 없는 상용직 계약으로 처리하는 것이 더 명확합니다. 표준근로계약서도 계약기간을 정하지 않는 경우를 별도 구조로 설명합니다.

앱 처리:
• 정규직 직원 → 상용직 계약서 선택
• 무기계약직 → 상용직 계약서 선택
• 기간 만료 후 정규직 전환 → 상용직 계약서로 재작성
• 관리자 화면 표시명: 상용직(정규직 포함)`,
    appRule: '앱에서 "상용직" 선택 시 계약서 부제에 "(기간의 정함이 없는 근로계약 — 정규직 포함)"이 자동 표시됩니다.',
    caution: '정규직이라는 이유로 종료일을 함께 입력하지 마세요. 종료일이 있다면 기간제입니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'REGULAR_EMPLOYMENT' },
    ],
    priority: 80,
    status: 'APPROVED',
    isActive: true,
  },

  // ── B. 일용직/계속근로 ──────────────────────────────────────────────────

  {
    id: 'faq_0006',
    category: 'DAILY_WORKER',
    question: '1개월 이상 계속 근무하면 일용직인가?',
    questionAliases: [
      '한 달 넘게 일하면 일용직인가요',
      '일용직인데 한 달째 나와요',
      '계속 일하는데 일용직 맞나요',
      '1개월 넘으면 상용직인가요',
      '한 달 이상 근무하면 어떤 계약인가요',
      '장기 일용직 가능한가요',
    ],
    shortAnswer: '보통 일용직으로 보기 어렵습니다.',
    fullAnswer: `고용노동부 FAQ는 일용근로자를 1개월 미만 고용되는 사람으로 보고, 1개월 이상이면 일용근로자가 아니라 상용근로자라고 설명합니다.

앱 처리 기준:
• 30일 이상 입력 + 일용직 선택 → 빨간 경고
• 상용직 또는 기간제 FAQ 자동 제안
• 종료일 있음 → 기간제, 종료일 없음 → 상용직`,
    appRule: '앱에서 일용직 선택 후 근무예정기간이 30일 이상으로 감지되면 경고 FAQ를 자동으로 노출합니다.',
    caution: '장기 고정근무자에게 일용직 계약서를 반복 사용하면 실제 근로관계와 계약이 충돌하여 법적 분쟁 시 불이익을 받을 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조 및 일용근로자 관련 행정해석',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'DAILY_EMPLOYMENT' },
      { context: 'CONTRACT_CREATE', field: 'expectedDurationDays', op: 'gte', value: 30 },
    ],
    priority: 98,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0007',
    category: 'DAILY_WORKER',
    question: '일용직인데 계속 근무하면 어떻게 되나?',
    questionAliases: [
      '일용직이 계속 나오면 어떻게 돼요',
      '매일 오는 일용직 어떻게 해요',
      '일용직인데 고정으로 나와요',
      '일용직 계속 쓰면 문제없나요',
      '일용직이 한 달째 근무 중이에요',
    ],
    shortAnswer: '계속 근무하면 일용직으로만 유지하기 어렵고 상용직 또는 기간제 검토 대상이 됩니다.',
    fullAnswer: `고용노동부 FAQ는 1개월 이상 고용이면 일용이 아니라 상용근로자라고 안내합니다. 건설업 관련 FAQ도 3개월 이상 계속 근무하거나 상용과 유사한 경우는 일용근로자에서 제외한다고 설명합니다.

앱 처리 기준:
• 일용직 + 1개월 이상 예상 → 경고
• 일용직 + 반복등록 누적 → 계속근로 FAQ 자동 노출
• 종료일 있음 → 기간제 검토, 종료일 없음 → 상용직 검토`,
    appRule: '동일 근로자가 동일 현장에 반복 등록될 경우, 앱에서 계속근로 관련 FAQ를 자동 표시합니다.',
    caution: '계속근로로 인정되면 퇴직금 산정 기준일이 최초 입사일로 소급될 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조, 퇴직급여 보장법 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 3 },
      { context: 'CONTRACT_CREATE', field: 'expectedDurationDays', op: 'gte', value: 30 },
    ],
    priority: 92,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0008',
    category: 'DAILY_WORKER',
    question: '일당 지급이면 무조건 일용직인가?',
    questionAliases: [
      '일당 받으면 일용직이에요',
      '일당으로 주면 다 일용직이에요',
      '일급 계산이면 일용직인가요',
      '하루치 임금이면 일용직 아닌가요',
      '일당 기준이면 무조건 일용직',
    ],
    shortAnswer: '아니요. 일당 지급만으로 일용직이 되지는 않습니다.',
    fullAnswer: `고용노동부 FAQ는 임금 계산이나 지급이 일 단위여도 근로계약기간이 1개월 이상이면 상용근로자라고 안내합니다. 판단 기준은 임금 단위만이 아니라 고용기간입니다.

앱 처리 기준:
• 일당 지급 + 1개월 미만 → 일용직 가능
• 일당 지급 + 1개월 이상 → 상용직/기간제 검토 경고 표시`,
    appRule: '앱에서 일용직 선택 시 "1개월 이상 근무 예정이면 상용직 검토" 경고를 표시합니다.',
    caution: '세금 신고(일용근로소득 vs. 근로소득)도 고용형태에 따라 달라집니다. 잘못된 유형 선택은 세무 신고 오류로 이어질 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조, 소득세법 제14조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'DAILY_EMPLOYMENT' },
    ],
    priority: 80,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0009',
    category: 'DAILY_WORKER',
    question: '계속근로자 계약서를 따로 만들어야 하나?',
    questionAliases: [
      '계속근로자 계약서',
      '계속근로 문서 따로 있나',
      '계속근로자는 뭘 선택',
      '장기근무 계약서',
      '계속근무 계약서',
    ],
    shortAnswer: '아니요. 계속근로자는 별도 계약서명이 아니라 상용직 또는 기간제 판단에 쓰는 개념입니다.',
    fullAnswer: `계속근로는 퇴직금, 연차, 반복계약 판단에서 중요한 개념입니다. 하지만 문서유형 자체를 "계속근로자 계약서"로 따로 나누기보다 종료일 유무에 따라 상용직/기간제로 나누는 것이 더 안전합니다.

앱 처리 기준:
• 계속근로 + 종료일 없음 → 상용직
• 계속근로 + 종료일 있음 → 기간제
• 단기 호출형 → 일용직`,
    appRule: '앱에서는 일용직·상용직·기간제 3종 직접고용 계약서를 제공합니다. 계속근로형 별도 계약서는 없으며 종료일 유무에 따라 기간제 또는 상용직 사용을 권장합니다.',
    caution: '같은 사람을 반복 계약하는 경우 계속근로 판단 경고를 따로 띄워야 합니다. 일용직 계약서를 장기간 반복 사용하면 실제 근로관계와 불일치 위험이 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조, 퇴직급여 보장법',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 4 },
    ],
    priority: 72,
    status: 'APPROVED',
    isActive: true,
  },

  // ── C. 반복계약 ──────────────────────────────────────────────────────────

  {
    id: 'faq_0010',
    category: 'REPEATED_CONTRACT',
    question: '1개월 단위로 입사·퇴사를 반복하면 일용직인가?',
    questionAliases: [
      '매달 계약서 다시 쓰면 일용직이에요',
      '한 달마다 퇴사 입사 반복해요',
      '매월 재계약하면 일용직인가요',
      '1개월 단위 반복 입퇴사',
      '달마다 계약서 새로 써요',
      '이 사람 매달 계약서 다시 쓰는데 일용직 맞아요',
    ],
    shortAnswer: '자동으로 일용직이라고 볼 수 없습니다. 반복 계약이면 계속근로 검토가 필요합니다.',
    fullAnswer: `1개월 이상 계약은 원칙적으로 일용직 기준과 맞지 않습니다. 생활법령정보는 계약을 반복 체결한 경우 갱신 또는 반복한 계약기간을 모두 합산한다고 설명합니다.

앱 처리 기준:
• 1개월 계약 반복 감지 → 반복계약 FAQ 자동 노출
• 일용직 고정 선택 금지 경고
• 기간제 또는 상용직 재검토 유도`,
    appRule: '동일 근로자가 같은 현장에 반복 등록될 경우 계속근로 관련 경고 FAQ를 자동 표시합니다.',
    caution: '형식적 입퇴사 반복으로 퇴직금·연차를 회피하려는 경우, 노동관계 법령 위반에 해당할 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '퇴직급여 보장법 제4조, 근로기준법 제60조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 2 },
    ],
    priority: 96,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0011',
    category: 'REPEATED_CONTRACT',
    question: '반복 계약은 계속근로로 볼 수 있나?',
    questionAliases: [
      '반복 계약이 계속근로인가요',
      '계약을 반복하면 퇴직금 계산 어떻게 해요',
      '계속근로 기간은 어떻게 계산해요',
      '반복 계약 시 퇴직금은',
      '매년 재계약하면 계속근로인가요',
    ],
    shortAnswer: '네. 동일 조건 반복 계약은 계속근로기간 합산 대상이 될 수 있습니다.',
    fullAnswer: `생활법령정보는 근로계약이 만료와 동시에 갱신되거나 동일 조건으로 반복 체결되면 반복한 계약기간을 모두 합산하여 계속근로년수를 계산한다고 설명합니다.

계속근로로 인정되면:
• 퇴직금: 최초 입사일부터 산정
• 연차휴가: 최초 입사일부터 산정
• 해고제한: 적용 가능성 증가

앱 처리 기준:
• 반복계약 감지 시 계속근로 FAQ 추천
• 장기 누적 시 상용직/기간제 전환 검토 플래그`,
    appRule: '동일 근로자 반복 등록 감지 시 계속근로 관련 경고를 표시합니다.',
    caution: '계속근로 인정은 퇴직금 소급 적용 외에 부당해고 보호, 연차 기준 소급 등 다양한 법적 효과를 가져옵니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '퇴직급여 보장법 제4조, 근로기준법 제23조',
    sourceUrl: 'https://www.law.go.kr/법령/퇴직급여보장법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 3 },
    ],
    priority: 88,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0012',
    category: 'REPEATED_CONTRACT',
    question: '같은 현장에서 같은 사람을 반복 계약하면 어떻게 봐야 하나?',
    questionAliases: [
      '같은 사람 반복 계약 어떻게 해요',
      '동일 근로자 반복 등록',
      '한 현장에 계속 같은 사람 써요',
      '같은 사람을 여러 번 계약해요',
      '반복 고용 주의사항',
    ],
    shortAnswer: '같은 현장·같은 업무로 반복 계약하면 계속근로 또는 반복계약 리스크가 커집니다.',
    fullAnswer: `반복 등록이 단순 예외인지, 실질적 계속고용인지 구분해야 합니다. 계속근로기간은 반복 계약을 합산해 볼 수 있습니다.

앱 처리 기준:
• 동일 현장 + 동일 근로자 + 유사 직무 재등록 시 경고
• 반복계약 FAQ 우선 노출
• 누적 12개월 이상 → 관리자에게 알림 표시`,
    appRule: '동일 근로자가 3회 이상 반복 등록되면 앱에서 자동으로 이 FAQ를 우선 표시합니다.',
    caution: '기간제법 위반(2년 초과 사용) 시 과태료 부과 대상이 될 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 3 },
    ],
    priority: 85,
    status: 'APPROVED',
    isActive: true,
  },

  // ── D. 기간제 ────────────────────────────────────────────────────────────

  {
    id: 'faq_0013',
    category: 'FIXED_TERM',
    question: '기간제는 언제 선택해야 하나?',
    questionAliases: [
      '기간제 언제 써요',
      '기간제 선택 기준',
      '기간제 계약서 쓰는 경우',
      '언제 기간제 계약서를 쓰나요',
      '기간제 해당하는 경우',
    ],
    shortAnswer: '시작일과 종료일이 명확한 근무라면 기간제를 선택합니다.',
    fullAnswer: `기간제는 근로기간이 정해져 있는 계약입니다. 특정 기간 동안만 근무하기로 정한 경우 기간제 문서를 쓰는 것이 맞습니다.

기간제 계약이 적합한 상황:
• 특정 프로젝트 기간 동안만 근무
• 출산·육아휴직 대체 인원
• 정해진 계절/공기에 맞춘 단기 고용

앱 처리 기준:
• 시작일 있음 + 종료일 있음 → 기간제 우선
• 종료일 미입력 시 기간제 생성 차단`,
    appRule: '기간제 계약서 생성 시 종료일 미입력이면 생성이 차단됩니다.',
    caution: '수습기간을 기간제로 처리하는 경우, 수습 기간도 2년 누적에 포함됩니다. 이후 정규직 전환 시 별도 상용직 계약서를 작성하세요.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'FIXED_TERM_EMPLOYMENT' },
    ],
    priority: 85,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0014',
    category: 'FIXED_TERM',
    question: '기간제 계약 종료 후 다시 계약하면 어떻게 관리해야 하나?',
    questionAliases: [
      '기간제 만료 후 재계약',
      '기간제 끝나고 다시 쓰면',
      '기간제 갱신 방법',
      '계약 만료 후 재고용',
      '기간제 연장하면 어떻게 해요',
    ],
    shortAnswer: '재계약이 반복되면 반복계약·계속근로 검토 경고를 함께 관리해야 합니다.',
    fullAnswer: `기간제 계약이 종료된 뒤 다시 계약하는 경우, 단순 신규계약처럼만 보지 말고 반복 여부를 추적해야 합니다. 반복 체결은 계속근로기간 합산 이슈와 연결될 수 있습니다.

앱 처리 기준:
• 이전 종료 기록 조회
• 재계약 시 반복횟수 표시
• 계속근로 FAQ 자동 추천
• 기간제 누적 2년 임박 시 무기계약 전환 알림`,
    appRule: '기간제 근로자의 누적 계약기간이 24개월에 가까워지면 앱에서 알림을 표시합니다.',
    caution: '기간제법 위반(2년 초과)은 과태료 대상이 되며, 법적으로 무기계약 전환이 강제됩니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조, 제5조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['FIXED_TERM_EMPLOYMENT', 'REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 2 },
    ],
    priority: 82,
    status: 'APPROVED',
    isActive: true,
  },

  // ── E. 외주/협력팀 ──────────────────────────────────────────────────────

  {
    id: 'faq_0015',
    category: 'OUTSOURCING',
    question: '외주/협력팀은 근로계약서 대상인가?',
    questionAliases: [
      '외주 팀도 계약서 써야 하나요',
      '협력업체 직원 계약서 필요해요',
      '외주 인력에게 근로계약서 발급해도 되나요',
      '하도급 인력 계약서',
      '외부 업체 소속 계약 어떻게 해요',
      '협력사 직원 문서 어떻게 해요',
    ],
    shortAnswer: '보통 자사 근로계약서 대상이 아니라 외주/협력팀 확인 문서 대상입니다.',
    fullAnswer: `외부 업체 소속 인력을 자사 근로자와 같은 계약서 흐름에 넣으면 관리가 혼동될 수 있습니다. 앱에서는 외주/협력팀을 별도 문서 흐름으로 분리하는 것이 안전합니다.

외주/협력팀에 적용하는 문서:
• 사업자 있는 경우: 도급·용역계약서, 소속 확인 문서
• 사업자 없는 경우 (팀장형): 팀장 책임확인서 세트
• 공통: 현장 출입관리 문서

앱 처리 기준:
• 외주/협력업체 소속 체크 시 근로계약서 대신 외주 문서 추천
• 직접고용 계약서 생성 자동 차단`,
    appRule: '앱에서 외주/협력팀 유형 선택 시 자사 직접고용 계약서(일용직/상용직/기간제) 생성이 자동 차단됩니다.',
    caution: '외주 인력에게 자사 근로계약서를 발급하면 실질적 고용관계 성립으로 볼 수 있어 법적 책임이 발생할 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '파견근로자 보호 등에 관한 법률, 근로기준법 제2조',
    sourceUrl: 'https://www.law.go.kr/법령/파견근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['SUBCONTRACT_WITH_BIZ', 'FREELANCER_SERVICE', 'NONBUSINESS_TEAM_REVIEW'],
    triggerConditions: [
      { context: 'CONTRACT_CREATE', field: 'workerSource', op: 'eq', value: 'OUTSOURCED' },
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'SUBCONTRACT_WITH_BIZ' },
    ],
    priority: 93,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0016',
    category: 'OUTSOURCING',
    question: '외주 인력을 일반 근로자로 등록해도 되나?',
    questionAliases: [
      '외주 사람 직원으로 등록해도 돼요',
      '협력업체 직원 근로자로 등록',
      '외부 인력 직접 등록 가능한가요',
      '외주 팀원 일용직으로 등록',
      '외주 인력 당사 근로자로 처리',
    ],
    shortAnswer: '외주/협력팀 소속 인원을 자사 근로자로 등록하면 안 됩니다. 외주/협력팀 유형으로 별도 등록합니다.',
    fullAnswer: `외주/협력팀 소속 인원을 자사 근로자(일용직·상용직·기간제)로 등록하면 아래 위험이 있습니다.

법적 위험:
• 실질적 고용관계 성립으로 자사 근로자 인정 가능
• 4대보험, 퇴직금, 연차 의무 발생
• 위장도급 또는 불법파견 논란
• 세금 신고 오류 (사업소득 vs. 근로소득)

올바른 처리:
• 외주/협력팀 유형으로 등록
• 도급·용역계약서 또는 팀장 책임확인서 발급
• 자사 급여대장에 포함하지 않음
• 출입·안전 관리 목적으로만 시스템 등록`,
    appRule: '앱에서 외주/협력팀 유형을 선택하면 자사 근로계약서 생성이 차단되고 외주 문서만 생성 가능합니다.',
    caution: '외주 인력이 실질적으로 자사의 지휘·감독을 받는다면 근로자성이 인정될 위험이 있습니다. 이 경우 외주 처리가 불법파견이 될 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '파견근로자 보호 등에 관한 법률 제2조',
    sourceUrl: 'https://www.law.go.kr/법령/파견근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['SUBCONTRACT_WITH_BIZ', 'NONBUSINESS_TEAM_REVIEW'],
    triggerConditions: [
      { context: 'WORKER_REGISTER', field: 'workerSource', op: 'eq', value: 'OUTSOURCED' },
    ],
    priority: 88,
    status: 'APPROVED',
    isActive: true,
  },

  // ── F. 앱 운영 ───────────────────────────────────────────────────────────

  {
    id: 'faq_0017',
    category: 'DOCUMENT_SELECTION',
    question: '계약유형을 잘못 선택했으면 어떻게 하나?',
    questionAliases: [
      '계약 유형 잘못 선택했어요',
      '계약서 유형 바꿀 수 있나요',
      '잘못 만든 계약서 어떻게 해요',
      '계약서 다시 만들어야 하나요',
      '유형 선택 실수 어떻게 해요',
    ],
    shortAnswer: '저장 후 그대로 두지 말고 즉시 수정 또는 재생성해야 합니다.',
    fullAnswer: `계약유형은 단순 문서 제목이 아니라 근무형태 분류 기준입니다. 종료일, 근무예정기간, 반복계약 여부를 다시 확인해 맞는 유형으로 바꾸어야 합니다.

앱 처리 기준:
• 계약유형 변경 기능 제공
• 이미 생성한 문서가 있으면 재생성 경고
• 변경 이력 저장

서명 전이라면 삭제 후 올바른 유형으로 재작성. 서명 후라면 양 당사자 합의로 처리.`,
    appRule: '앱에서 계약서 생성 전 유형 확인 단계와 서명 직전 확인 단계에서 재확인을 유도합니다.',
    caution: '서명 후 계약서를 일방적으로 무효화하면 법적 분쟁이 발생할 수 있습니다. 반드시 쌍방 합의 후 처리하세요.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [],
    priority: 75,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0018',
    category: 'DOCUMENT_SELECTION',
    question: '계약서 생성 전 무엇을 다시 확인해야 하나?',
    questionAliases: [
      '계약서 만들기 전 확인사항',
      '계약서 생성 전 체크리스트',
      '계약서 만들기 전에 볼 것',
      '계약서 생성 전 주의사항',
      '계약 전 확인해야 할 것',
    ],
    shortAnswer: '생성 전에는 종료일 유무, 근무예정기간, 반복등록 여부를 꼭 다시 확인해야 합니다.',
    fullAnswer: `일용/상용/기간제 구분에서 가장 자주 틀리는 것은 종료일과 계속근로 여부입니다. 반복 등록되는 사람인지까지 같이 봐야 계약유형 실수를 줄일 수 있습니다.

생성 직전 체크리스트:
• 종료일 있음/없음
• 1개월 이상 여부
• 동일 근로자 재등록 여부
• 외주/협력팀 여부`,
    appRule: '앱에서 계약서 생성 직전 "생성 예정 문서 목록"과 "검증 결과"를 자동으로 표시합니다.',
    caution: '계약서 생성 후 서명이 완료되면 수정이 어렵습니다. 생성 전에 모든 입력값을 꼼꼼히 확인하세요.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_CREATE', field: 'startDate', op: 'exists' },
    ],
    priority: 78,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0019',
    category: 'LEGAL_WARNING',
    question: '관리자 입장에서 가장 많이 실수하는 선택은 무엇인가?',
    questionAliases: [
      '자주 하는 실수',
      '관리자들이 많이 틀리는 것',
      '계약 유형 선택 실수',
      '많이 틀리는 계약 유형',
      '실수하기 쉬운 계약',
    ],
    shortAnswer: '가장 흔한 실수는 ① 장기 고정근무자에게 일용직 반복 사용, ② 상용직에 종료일 입력, ③ 외주 인력에 근로계약서 발급입니다.',
    fullAnswer: `실무에서 자주 발생하는 계약유형 선택 실수 3가지:

1. 장기 고정근무자에게 일용직 반복 사용
   • "어차피 일당 주니까" 라는 이유로 계속 일용직 사용
   • 위험: 실질적 상용직으로 인정 시 퇴직금 소급 적용
   • 권장: 1개월 이상 예정이면 기간제 또는 상용직으로 전환

2. 상용직을 선택하면서 종료일도 함께 입력
   • "혹시 모르니까" 종료일 추가
   • 위험: 기간제로 해석될 수 있으며, 계약 의도 불명확해짐
   • 권장: 종료일 없음 = 상용직, 종료일 있음 = 기간제

3. 외주/협력팀 인력에게 자사 근로계약서 발급
   • "현장 기록이 필요해서" 일용직 계약서 생성
   • 위험: 자사 근로자로 인정 가능, 불법파견 논란
   • 권장: 외주/협력팀 유형 선택 → 확인 문서 발급`,
    appRule: '앱에서 이 3가지 상황 감지 시 자동으로 경고 FAQ를 표시합니다.',
    caution: '계약유형 선택 실수는 단순 행정 문제가 아니라 법적 의무(퇴직금, 보험, 세금)의 오적용으로 이어집니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제2조, 기간제법 제4조, 파견근로자보호법',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'SUBCONTRACT_WITH_BIZ'],
    triggerConditions: [],
    priority: 70,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0020',
    category: 'LEGAL_WARNING',
    question: '상용직인데 종료일이 있는 경우 어떻게 하나?',
    questionAliases: [
      '상용직인데 종료일을 넣었어요',
      '상용직에 종료일 입력해도 되나요',
      '상용직이지만 끝날 날이 있어요',
      '정규직인데 계약 기간이 있어요',
      '상용직 종료일 문제',
    ],
    shortAnswer: '종료일이 있으면 기간제로 처리하는 것이 맞습니다.',
    fullAnswer: `상용직은 종료일 없이 계속근무하는 구조입니다. 종료일이 정해져 있으면 상용직보다 기간제 문서가 맞습니다.

앱 처리 기준:
• 상용직 화면에서 종료일 입력 시 기간제 추천 모달
• 저장 전 재선택 요구`,
    appRule: '앱에서 상용직 계약서 생성 시 종료일이 입력되어 있으면 경고 메시지와 함께 이 FAQ를 표시합니다.',
    caution: '상용직에 종료일을 넣는 것 자체가 계약의 성격을 불명확하게 만들어 나중에 분쟁의 소지가 됩니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조, 기간제법 제4조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_CREATE', field: 'endDate', op: 'exists' },
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'REGULAR_EMPLOYMENT' },
    ],
    priority: 91,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0021',
    category: 'REPEATED_CONTRACT',
    question: '반복 갱신 계약은 어떻게 관리해야 하나?',
    questionAliases: [
      '반복 갱신 관리 방법',
      '계약 갱신 기록 어떻게 해요',
      '기간제 갱신 횟수 관리',
      '같은 사람 계속 계약서 써요',
      '반복 계약 관리 체계',
    ],
    shortAnswer: '반복 갱신 시 누적 계약기간을 반드시 추적하고, 2년 초과 여부를 확인하세요.',
    fullAnswer: `반복 갱신 계약 관리 지침:

1. 누적 기간 추적
   • 동일 사용자 + 동일 업무 기간제 누적 = 최대 2년
   • 갱신 시마다 시작일부터 누적 계산

2. 갱신 방법
   • 만료 전 서면 갱신 협의
   • 새로운 기간제 계약서 작성 (단순 구두 연장 금지)

3. 2년 임박 시 대응
   • 무기계약 전환 여부 결정
   • 계약 종료(갱신 거절) 여부 결정 (단, 갱신 기대권 주의)

4. 갱신 거절 시
   • 충분한 사전 통보
   • 갱신 기대권이 있다면 부당해고 위험`,
    appRule: '앱에서 기간제 근로자의 누적 계약기간이 24개월에 가까워지면 알림을 표시할 예정입니다.',
    caution: '반복 갱신으로 형성된 갱신 기대권을 이유로 갱신을 거절하면 부당해고로 볼 수 있습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '기간제 및 단시간근로자 보호 등에 관한 법률 제4조, 제5조',
    sourceUrl: 'https://www.law.go.kr/법령/기간제및단시간근로자보호등에관한법률',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 2 },
    ],
    priority: 82,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0022',
    category: 'DOCUMENT_SELECTION',
    question: '종료일 없이 계속 근무시키려면 어떤 계약서를 써야 하나?',
    questionAliases: [
      '계속 쓰고 싶은데 어떤 계약서',
      '종료일 없이 근무 계약',
      '장기 근무 계약서',
      '끝날 날짜 없이 계속 일하려면',
      '무기한 계약서 어떤 거예요',
    ],
    shortAnswer: '종료일 없이 계속 근무하려면 상용직(무기계약) 근로계약서를 사용하세요.',
    fullAnswer: `근로자를 종료일 없이 계속 고용하려면 상용직(기간의 정함이 없는 근로계약) 근로계약서를 사용합니다.

상용직 계약의 특징:
• 계약서에 종료일을 적지 않습니다.
• 근로자가 스스로 퇴직하거나 회사가 정당한 이유로 해고하기 전까지 근로관계가 유지됩니다.
• 퇴직금: 1년 이상 근무 시 발생
• 해고제한: 정당한 이유 없이 해고 불가

이 앱에서:
• 상용직 근로계약서: 기간의 정함이 없는 근로계약 (정규직 포함)
• 필수 입력: 임금, 시업·종업 시각
• 종료일 입력 불필요 (입력 시 경고 표시)`,
    appRule: '상용직 계약서 생성 시 종료일 필드는 선택 입력으로 처리되며, 입력 시 경고가 표시됩니다.',
    caution: '상용직으로 계약 후 나중에 "기간제였다"고 주장하는 것은 법적으로 인정받기 어렵습니다.',
    sourceOrg: '고용노동부',
    sourceTitle: '근로기준법 제17조',
    sourceUrl: 'https://www.law.go.kr/법령/근로기준법',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['REGULAR_EMPLOYMENT'],
    triggerConditions: [
      { context: 'CONTRACT_TYPE_SELECT', field: 'selectedContractType', op: 'eq', value: 'REGULAR_EMPLOYMENT' },
    ],
    priority: 78,
    status: 'APPROVED',
    isActive: true,
  },

  // ── G. 신규: 반복 등록 / 전환 ────────────────────────────────────────────

  {
    id: 'faq_0023',
    category: 'REPEATED_CONTRACT',
    question: '같은 사람을 계속 등록하면 일용직으로 유지 가능한가?',
    questionAliases: [
      '같은 사람 계속 등록',
      '반복 등록 일용직',
      '계속 넣어도 되나',
      '재등록하면 일용직 유지',
      '같은 현장 반복 계약',
    ],
    shortAnswer: '반복 등록이 계속되면 일용직 유지가 부적절할 수 있습니다.',
    fullAnswer: `같은 사람을 같은 현장에 반복 등록하면 실질적으로 계속근로 또는 반복계약으로 볼 가능성이 커집니다. 반복된 기간은 계속근로기간 산정에서 합산될 수 있습니다.

앱 처리 기준:
• 동일 근로자 + 동일 현장 재등록 감지
• 2회차부터 경고, 3회차 이상 강한 경고
• 상용직/기간제 FAQ 자동 노출`,
    appRule: '동일 근로자가 3회 이상 반복 등록되면 앱에서 이 FAQ와 계속근로 FAQ를 우선 표시합니다.',
    caution: '단순 재등록 횟수만이 아니라 공백 기간, 업무 동일성도 같이 봐야 합니다.',
    sourceOrg: '고용노동부',
    sourceTitle: 'FAQ / 기준일 2026-03-23',
    sourceUrl: 'https://www.moel.go.kr/faq/faqView.do?seqRepeat=216',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 2 },
    ],
    priority: 88,
    status: 'APPROVED',
    isActive: true,
  },

  {
    id: 'faq_0024',
    category: 'REPEATED_CONTRACT',
    question: '반복 계약 시 상용직 또는 기간제로 전환해야 하나?',
    questionAliases: [
      '반복 계약 전환',
      '계속 쓰면 상용직으로 바꿔야 하나',
      '기간제로 바꿔야 하나',
      '재계약 계속되면 어떤 계약',
      '반복계약 문서 변경',
    ],
    shortAnswer: '반복 계약이 누적되면 상용직 또는 기간제 전환 검토가 맞습니다.',
    fullAnswer: `1개월 이상 계약이나 반복 체결은 일용직 유지보다 상용직·기간제 구조가 더 적합할 수 있습니다. 종료일이 계속 있으면 기간제, 종료일 없이 계속 쓰면 상용직 검토가 맞습니다.

앱 처리 기준:
• 반복횟수 누적 시 전환 검토 배너
• 종료일 있음 → 기간제, 종료일 없음 → 상용직 추천`,
    appRule: '반복횟수 3회 이상 시 전환 검토 배너를 표시합니다. 종료일 유무에 따라 기간제 또는 상용직 검토를 유도합니다.',
    caution: '형식상 반복계약만으로 자동 전환하지는 않되, 관리자 재확인은 필수입니다.',
    sourceOrg: '고용노동부',
    sourceTitle: 'FAQ / 기준일 2026-03-23',
    sourceUrl: 'https://www.moel.go.kr/faq/faqView.do?seqRepeat=216',
    effectiveDate: '2026-03-23',
    relatedContractTypes: ['DAILY_EMPLOYMENT', 'REGULAR_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT'],
    triggerConditions: [
      { context: 'REPEAT_REGISTRATION', field: 'repeatedCount', op: 'gte', value: 3 },
    ],
    priority: 85,
    status: 'APPROVED',
    isActive: true,
  },
]
