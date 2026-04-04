# 운영 런북 — attendance 자동화 (2026-04-04)

## 1. 자동 작업 (cron)

| 항목 | 주기 | 명령 | 로그 |
|------|------|------|------|
| 빠른 헬스체크 | `*/5 * * * *` | `scheduled_check.sh --quick` | `logs/scheduled_quick_YYYYMMDD_HHMMSS.log` |
| 전체 점검 | `0 * * * *` | `scheduled_check.sh --full` | `logs/pipeline_YYYYMMDD_HHMMSS.log` |
| DB 백업 | `0 2 * * *` | `backup_db.sh db` | `logs/backup_db.log` |

모두 `/home/ubuntu/app/attendance/` 기준 실행.  
백업은 `ops-bot/.env` → `DB_PASSWORD` 로드 후 `attendance_app` 계정으로 `pg_dump`.

---

## 2. 수동 작업

### JWT 검증
```bash
export OPS_LOGIN_ID='jay@haehan-ai.kr'
export OPS_LOGIN_PW='Haehan2026!'
bash ~/app/ops-bot/scripts/check_jwt_runtime.sh
```
기대 결과: `결과: PASS — sign→verify 정상`

### 백업 수동 실행
```bash
set -a; source ~/app/attendance/ops-bot/.env; set +a
bash ~/app/ops-bot/scripts/backup_db.sh db
```
기대 결과: `결과: PASS`, 크기 4M 이상

### 점검 수동 실행
```bash
cd ~/app/attendance
bash scripts/scheduled_check.sh --quick   # 빠른 (5항목)
bash scripts/deploy_and_check.sh --check-only  # 전체 점검
```

---

## 3. 경로 정리

| 구분 | 경로 |
|------|------|
| 앱 루트 | `~/app/attendance/` |
| 로그 디렉터리 | `~/app/attendance/logs/` |
| ops-bot 스크립트 | `~/app/ops-bot/scripts/` |
| ops-bot 환경변수 | `~/app/attendance/ops-bot/.env` |
| DB 백업 | `/mnt/nas/attendance/backups/attendance_YYYYMMDD_HHMMSS.sql.gz` |
| 백업 보존 | 30일 (자동 삭제) |

---

## 4. 장애 확인 순서

1. **헬스체크 로그 확인**
   ```bash
   tail -20 ~/app/attendance/logs/scheduled_quick_$(ls ~/app/attendance/logs/scheduled_quick_*.log | tail -1 | xargs basename)
   ```

2. **컨테이너 상태**
   ```bash
   docker ps --filter name=attendance
   docker logs attendance --tail 50
   ```

3. **JWT 인증 확인**
   ```bash
   export OPS_LOGIN_ID='jay@haehan-ai.kr' OPS_LOGIN_PW='Haehan2026!'
   bash ~/app/ops-bot/scripts/check_jwt_runtime.sh
   ```

4. **백업 파일 확인**
   ```bash
   ls -lh /mnt/nas/attendance/backups/ | tail -5
   ```

5. **전체 파이프라인 로그**
   ```bash
   ls -t ~/app/attendance/logs/pipeline_*.log | head -1 | xargs tail -50
   ```

---

## 5. 배포 스크립트 실행 제약 (Level B)

`deploy.sh` / `deploy_and_check.sh` / `deploy_rollback.sh` 는 **로컬 PC 전용**이다.

### 허용
- 로컬 터미널에서 직접 실행: `bash scripts/deploy_and_check.sh "메시지"`
- `--auto` 플래그 명시 시 승인 게이트 우회: `bash scripts/deploy_and_check.sh "메시지" --auto`

### 금지
| 금지 유형 | 결과 |
|-----------|------|
| cron 에 deploy_and_check.sh 등록 | `[ABORT]` 비대화형 환경 차단 |
| ssh 비대화형 파이프로 실행 | `[ABORT]` 비대화형 환경 차단 |
| CI/CD 파이프라인 직접 호출 | `[ABORT]` 비대화형 환경 차단 |
| 서버(ubuntu) 내부 직접 실행 | `[BLOCK]` 로컬 전용 차단 |

### 롤백 주의사항
- `deploy_rollback.sh` 는 **대화형 터미널 수동 실행만** 허용
- 비대화형 환경에서 실행 시 `[ABORT]` 즉시 종료
- 실검증 필요: 실제 배포 후 `prev_commit != current` 상태에서 1회 실행하여 검증할 것

---

## 6. 알려진 WARN 항목 (기능 영향 없음)

| 항목 | 내용 | 조치 |
|------|------|------|
| Playwright 미설치 | `@playwright/test` 모듈 없음 → E2E 스킵 | 필요 시 `npm install` |
| 모바일 카드 UI | `bg-white + rounded-2xl` 6개 → `bg-card` 치환 후보 | 디자인 토큰 정리 시 반영 |
| SSH PEM 경로 | `~/.ssh/haehan-ai.pem` 없음 → 스크립트 내 SSH 호출 실패 | PEM 위치 확인 필요 |
