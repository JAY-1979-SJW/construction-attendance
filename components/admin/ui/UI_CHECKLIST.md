# Admin 페이지 UI 검토 체크리스트

safety-docs 기준으로 확정. 새 페이지 또는 기존 페이지 수정 시 이 목록을 점검한다.
수치 기준은 `ui-spec.ts` 참조.

## 1. 레이아웃

- [ ] `PageShell` 사용 (배경 #F5F7FA, p-5/p-6)
- [ ] 사이드바 220px, 탑바 56px 기준 overflow 없음
- [ ] 페이지 타이틀은 `AdminLayoutWrapper`에서 자동 — 페이지 내 중복 없음

## 2. 필터 영역

- [ ] `FilterBar` 컴포넌트 사용 (flex, gap-2, mb-4)
- [ ] 텍스트 검색: `FilterInput` (h-9, 36px)
- [ ] 드롭다운 필터: `FilterSelect` (h-9)
- [ ] 상태 토글: `FilterPill` (h-9)
- [ ] 우측 버튼 정렬: `FilterSpacer` + `Btn`

## 3. 테이블

- [ ] `AdminTable` 사용 (자체 border/radius 포함 — SectionCard 이중 래핑 금지)
- [ ] 헤더: text-11px, py-10px, bg-#F3F4F6
- [ ] 행: text-13px, py-10px
- [ ] 빈 상태: `EmptyRow`
- [ ] 긴 텍스트 셀: `className="max-w-[Npx] truncate"`
- [ ] 클릭 가능 행: `AdminTr onClick`

## 4. 모달

- [ ] `Modal` 컴포넌트 사용 (인라인 overlay 금지)
- [ ] 기본 폭: 480px (큰 폼은 600px까지 허용)
- [ ] 헤더: h-52px (topbar 리듬)
- [ ] 본문: p-5 (카드 패딩 동일)
- [ ] 닫기: Modal 내장 X 버튼
- [ ] 에러 표시: `Toast variant="error"`
- [ ] 하단 버튼: `ModalFooter` + `Btn`

## 5. 상세 패널

- [ ] `DetailPanel` 사용 (420px, 우측 슬라이드)
- [ ] 메타 정보: `MetaRow` (label 72px)
- [ ] 액션 버튼: DetailPanel `actions` prop
- [ ] 문서 내용: max-h-400px, pre, whitespace-pre-wrap, break-words

## 6. 탭 바

- [ ] `Tabs` 컴포넌트 사용
- [ ] text-13px, py-10px, px-16px
- [ ] active: #F97316, font-semibold
- [ ] badge: 빨간 카운트 pill (optional)

## 7. 버튼

- [ ] `Btn` 컴포넌트 사용 (인라인 button 금지)
- [ ] variant: orange(CTA), secondary(취소), danger(삭제), success(승인), ghost(닫기)
- [ ] size: md(기본), sm(패널/목록), xs(테이블 인라인)

## 8. 폼 입력

- [ ] `FormInput`, `FormSelect`, `FormTextarea` 사용
- [ ] 높이: h-10 (40px)
- [ ] 라벨: text-12px, font-semibold
- [ ] 2열 배치: `FormGrid cols={2}`

## 9. 상태 배지

- [ ] `StatusBadge` 사용
- [ ] text-11px, px-2, py-0.5, rounded-full, border

## 10. 알림/토스트

- [ ] 인라인 알림: `Toast` (success/error/warning/info)
- [ ] 고정 알림: `FloatingToast` (fixed bottom-right, 자동 3초 닫힘)
- [ ] 인라인 에러 div, p 태그 대신 공용 컴포넌트 사용

## 11. 기타

- [ ] border-radius: 12px 통일 (10px, xl 금지)
- [ ] overlay: bg-black/40 통일 (30, 50 금지)
- [ ] 색상: #059669(성공), #B91C1C(에러) — Btn variant 색상과 동일
- [ ] KPI 카드: 공용 `KpiCard` 사용 (dashboard 전용 인라인 허용)
