/**
 * UI 수치 기준 상수
 *
 * safety-docs 페이지에서 확정, 전 admin 페이지에 동일 적용.
 * 새 페이지 또는 컴포넌트 작성 시 이 상수를 참조한다.
 * Tailwind 클래스와 1:1 대응하므로, 값 자체보다
 * "어떤 수치가 기준인지"를 한 곳에서 관리하는 것이 목적.
 */

// ── 레이아웃 ─────────────────────────────────────────────────
export const SIDEBAR_WIDTH = 220            // px — AdminLayoutWrapper
export const TOPBAR_LINE = 4               // px — 오렌지 상단 라인
export const TOPBAR_BAR = 52               // px — 헤더 바 높이
export const TOPBAR_HEIGHT = TOPBAR_LINE + TOPBAR_BAR  // 56px 합계

// ── 카드/섹션 ────────────────────────────────────────────────
export const CARD_PADDING = 20             // px — p-5 (SectionCard)
export const CARD_RADIUS = 12              // px — rounded-[12px]
export const SECTION_GAP = 20              // px — my-5 (SectionDivider)

// ── 필터 영역 ────────────────────────────────────────────────
export const FILTER_INPUT_H = 36           // px — h-9 (FilterInput, FilterSelect, FilterPill)

// ── 폼 입력 ──────────────────────────────────────────────────
export const FORM_INPUT_H = 40             // px — h-10 (FormInput, FormSelect, FormTextarea)

// ── 버튼 ─────────────────────────────────────────────────────
export const BTN_XS_H = 26                // px 근사 — text-11px, py-5px
export const BTN_SM_H = 30                // px 근사 — text-12px, py-1.5
export const BTN_MD_H = 34                // px 근사 — text-13px, py-7px

// ── 테이블 ───────────────────────────────────────────────────
export const TABLE_HEADER_PY = 10          // px — py-[10px]
export const TABLE_HEADER_FONT = 11        // px — text-[11px]
export const TABLE_ROW_PY = 10             // px — py-[10px]
export const TABLE_ROW_FONT = 13           // px — text-[13px]

// ── 상태 배지 ────────────────────────────────────────────────
export const BADGE_FONT = 11               // px — text-[11px]
export const BADGE_PX = 8                  // px — px-2
export const BADGE_PY = 2                  // px — py-0.5

// ── 모달 ─────────────────────────────────────────────────────
export const MODAL_WIDTH = 480             // px — 기본 생성 모달
export const MODAL_HEADER_H = 52           // px — topbar 리듬
export const MODAL_BODY_PADDING = 20       // px — p-5

// ── 상세 패널 ────────────────────────────────────────────────
export const DETAIL_PANEL_WIDTH = 420      // px — DetailPanel 우측 슬라이드

// ── 메타 정보 ────────────────────────────────────────────────
export const META_LABEL_WIDTH = 72         // px — MetaRow label 고정폭

// ── 문서 미리보기 ────────────────────────────────────────────
export const CONTENT_PREVIEW_MAX_H = 400   // px — max-h-[400px]

// ── 토스트/알림 ──────────────────────────────────────────────
export const TOAST_FONT = 12               // px — text-[12px]
export const TOAST_RADIUS = 8              // px — rounded-[8px]
export const TOAST_PADDING = 10            // px — p-2.5

// ── 탭 바 ────────────────────────────────────────────────────
export const TAB_FONT = 13                 // px — text-[13px]
export const TAB_PY = 10                   // px — py-[10px]
export const TAB_PX = 16                   // px — px-4

// ── 색상 (공통 accent) ──────────────────────────────────────
export const COLOR_ORANGE = '#F97316'
export const COLOR_ORANGE_HOVER = '#EA580C'
export const COLOR_BG = '#F5F7FA'
export const COLOR_BORDER = '#E5E7EB'
export const COLOR_BORDER_LIGHT = '#F3F4F6'
export const COLOR_TEXT_PRIMARY = '#0F172A'
export const COLOR_TEXT_BODY = '#374151'
export const COLOR_TEXT_MUTED = '#6B7280'
export const COLOR_TEXT_FAINT = '#9CA3AF'
