/**
 * 모바일 UI 공통 텍스트 스타일
 *
 * 원칙:
 *  - 본문 최소 14px (text-sm)
 *  - 카드 제목 최소 16px (text-base)
 *  - 보조 설명 최소 13px
 *  - 배지/캡션 최소 12px (text-xs)
 *  - break-all 금지, break-keep 기본
 *  - 카드 설명 line-clamp-2
 */

export const uiText = {
  /** 페이지 제목 — 24px bold */
  pageTitle: "text-2xl font-bold leading-tight tracking-[-0.01em] text-gray-900",

  /** 섹션 제목 — 20px bold */
  sectionTitle: "text-xl font-bold leading-snug tracking-[-0.01em] text-gray-900",

  /** 카드 제목 — 16px semibold */
  cardTitle: "text-base font-semibold leading-snug text-gray-900",

  /** 본문 — 14px */
  body: "text-sm leading-6 font-normal text-gray-700",

  /** 보조 설명 — 13px */
  caption: "text-[13px] leading-5 font-normal text-gray-500",

  /** 배지 — 12px */
  badge: "text-xs font-semibold leading-none",

  /** 버튼 — 14px */
  button: "text-sm font-semibold leading-none",

  /** 라벨 — 14px medium */
  label: "text-sm font-medium text-gray-700",

  /** 입력값 — 16px (iOS 줌 방지) */
  input: "text-base",

  /** 안내/오류 문구 — 13px */
  hint: "text-[13px] leading-5 text-gray-500",

  /** 상태값 텍스트 — 13px semibold */
  status: "text-[13px] font-semibold leading-5",
} as const
