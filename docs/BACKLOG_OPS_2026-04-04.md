# 운영 자동화 후순위 backlog (2026-04-04)

## B-00 롤백 실검증 (대기 중 — 다음 실제 배포 후 실행)

- **상태**: 대기 중 — `deploy_rollback.sh` 스크립트 완성 + 게이트 버그 수정 완료 (`17e55b5`)
- **실행 조건**: 실제 배포 후 `logs/last_deploy_state.txt` 의 `prev_commit != current` 인 상태
- **체크포인트**:
  1. `prev_commit` 값 확인: `grep prev_commit logs/last_deploy_state.txt`
  2. `bash scripts/deploy_rollback.sh` 실행 → 이전 커밋 복구 확인
  3. `bash scripts/scheduled_check.sh --quick` + `bash ops-bot/scripts/check_jwt_runtime.sh` PASS 확인
- **완료 기준**: 헬스체크 PASS + JWT PASS + 커밋 복구 확인
- **완료 기록 위치**: `docs/BACKLOG_OPS_2026-04-04.md` B-00 에 결과 업데이트 또는 별도 완료 문서 작성

---

## B-01 디자인 토큰 치환 — bg-white + rounded-2xl

- **내용**: `bg-white + rounded-2xl` 조합 6건 → `bg-card` 토큰으로 치환
- **영향**: 기능 영향 없음. `deploy_and_check.sh` 정적 분석 WARN 제거 목적
- **파일**: `audit_mobile_card.sh` WARN 파일 목록 참조 (최신 파이프라인 로그)
- **우선순위**: 낮음

## B-02 로컬 실행용 SSH_KEY 경로 문서 보강

- **내용**: 로컬 머신에서 `scripts/deploy.sh` / `check_container_health.sh` 실행 시
  PEM 키 경로 명시
  ```bash
  # ~/.ssh/haehan-ai.pem 없을 때
  SSH_KEY="C:/Users/skyjw/OneDrive/03. PYTHON/haehan-ai/haehan-ai.pem" \
    bash scripts/deploy.sh
  ```
- **현재 상태**: `SSH_KEY` env var 지원은 완료(`d7d8094`). 문서만 미비
- **우선순위**: 낮음

## B-03 구 Telegram 토큰 git 이력 정리 (선택)

- **내용**: 이전 커밋에 평문 노출된 구 토큰(`AAE6rMq8...`, `AAHFGKzo...`) git 이력 잔존
- **방법**: `git filter-repo` 또는 BFG Repo Cleaner로 이력 재작성 필요
- **현황**: 구 토큰은 이미 폐기 처리됨 → 보안 위협 없음
- **주의**: force push 필요, 협업자 전원 re-clone 필요
- **우선순위**: 선택 (보안 감사 요구 시 진행)
