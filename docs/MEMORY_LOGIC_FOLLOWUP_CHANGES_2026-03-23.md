# 메모리 로직화 후속 보강 1차 — 실제 수정 내역 (2026-03-23)

## 수정 파일 목록

### 수정 1: 위험 문구 경고 관리자 UI 노출

**파일**: `app/admin/contracts/[id]/page.tsx`

**수정 내용**:
1. `dangerWarnings: string[]` state 추가
2. `generatePdf()` 함수에서 `json.data.warnings` 처리 → `setDangerWarnings()` 호출
3. 경고 박스 UI 추가 (Advisory Mode):
   - 빨간 배경 박스, 위험 문구 목록 렌더링
   - 운영자 확인 사항 안내 (3가지 체크 항목)
   - "경고 닫기" 버튼으로 수동 해제 가능
   - 계약서 생성 자체는 차단하지 않음 (Advisory)

**영향 범위**: 일용직 계약서 생성 시 위험 문구 감지 → 관리자 화면에 표시. 타 계약 유형 영향 없음.

---

### 수정 2: workerName 스냅샷 불변성 보장

**파일**: `app/api/admin/contracts/[id]/generate-pdf/route.ts`

**수정 내용**:
- 계약서 PDF 생성 시, 해당 버전의 `ContractVersion.snapshotJson`이 이미 존재하면 `snapshotJson.worker.name`을 `workerName`으로 우선 사용
- 스냅샷이 없으면 (첫 생성) 기존대로 live `contract.worker.name` 사용 후 스냅샷 생성

**왜**: PDF 재생성 시 근로자 마스터의 이름이 변경되어 있어도 원래 계약 당시의 이름을 유지 (계약서 불변성 원칙)

**영향 범위**: PDF 재생성 경로만 해당. 첫 생성 시 동작 변화 없음.

---

### 수정 3: bankAccount 레거시 평문 fallback 제거

**파일**: `app/admin/contracts/new/page.tsx`

**수정 내용**:
- 근로자 선택 시 계약 자동채움에서 `w.bankAccount` (레거시 평문 계좌번호) fallback 제거
- `w.bankAccountSecure?.accountNumberMasked`만 사용 (없으면 빈 문자열)

**왜**: 레거시 `Worker.bankAccount` 필드는 평문 계좌번호를 포함할 수 있으며, 이 값이 계약 필드에 그대로 삽입되면 PDF/문서에 평문 계좌번호가 노출됨

**영향 범위**: 계약 신규 생성 화면의 계좌번호 자동채움. `bankAccountSecure`가 없는 구 근로자의 경우 계좌번호 필드가 빈 값으로 자동채움되므로 운영자가 수동 입력 필요.

---

## 비수정 항목

| 항목 | 이유 |
|------|------|
| COMPANY_ADMIN API 스코프 | 전수 점검 결과 12개 전 API 정상 — 수정 불필요 |
| Worker.bankAccount 컬럼 삭제 | 기존 레거시 데이터 보존 필요 — 별도 마이그레이션 계획 |
| Worker.bankName 컬럼 삭제 | 동일 이유 |
| 근로자 상세 화면 bankName fallback | 표시용이므로 허용 — 평문 계좌번호 미노출 |
