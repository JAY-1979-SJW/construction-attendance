# 운영 자동화 1차 완료 — attendance (2026-04-04)

## 완료 범위

| 항목 | 상태 | 커밋 |
|------|------|------|
| 자동화 스크립트 민감정보 제거 (BOT_TOKEN·DB PW·admin 자격증명) | 완료 | `dcf533e` |
| PID 기반 중복 실행 방지 (deploy/scheduled_check/deploy_and_check) | 완료 | `dcf533e` |
| backup_db.sh — `attendance_app` 계정 전환, `set -e` + `&&` 충돌 수정 | 완료 | `d21b365` `e230872` |
| check_jwt_runtime.sh — 컨테이너 IP 동적 조회, Set-Cookie 헤더 직접 파싱 | 완료 | `760de22` `b5a37fc` |
| JWT 인증 전체 장애 수정 — Edge Runtime Prisma 충돌, isBlacklisted try-catch 분리 | 완료 | `cf82fae` |
| Playwright @playwright/test + WebKit 설치, E2E 모바일 점검 정상화 | 완료 | 서버 직접 설치 |
| SSH_KEY 경로 env var 표준화 (check_container_health / deploy) | 완료 | `d7d8094` |
| check_container_health.sh — SSH 없음 시 로컬 Docker 직접 점검 전환 | 완료 | `801f794` |
| deploy_and_check.sh — `\|\| true` 제거, exit code 정확 캡처 | 완료 | `801f794` |
| DB 백업 cron 등록 (매일 02:00) | 완료 | crontab |
| scheduled_check cron 로그 경로 수정 (`/dev/null` → 실제 파일) | 완료 | crontab |
| ops-bot Telegram 토큰 교체 및 서버 반영 | 완료 | 서버 `.env` |
| 장애 문서 (JWT Edge Runtime 원인·수정·검증) | 완료 | `163381d` |
| 운영 런북 작성 | 완료 | `e6d73c7` |

---

## 핵심 스크립트

```bash
# 1. 전체 점검 (파이프라인)
cd ~/app/attendance
bash scripts/deploy_and_check.sh --check-only

# 2. 빠른 헬스체크 (5분 cron과 동일)
bash scripts/scheduled_check.sh --quick

# 3. JWT sign→verify 검증
export OPS_LOGIN_ID='jay@haehan-ai.kr'
export OPS_LOGIN_PW='Haehan2026!'
bash ~/app/ops-bot/scripts/check_jwt_runtime.sh

# 4. DB 백업 수동 실행
set -a; source ~/app/attendance/ops-bot/.env; set +a
bash ~/app/ops-bot/scripts/backup_db.sh db

# 5. 컨테이너 헬스체크 (로컬 Docker 직접)
bash scripts/check_container_health.sh
```

---

## 경로 정리

| 구분 | 경로 |
|------|------|
| 앱 루트 | `~/app/attendance/` |
| 로그 디렉터리 | `~/app/attendance/logs/` |
| 빠른 점검 로그 | `logs/scheduled_quick_YYYYMMDD_HHMMSS.log` (5분마다) |
| 전체 파이프라인 로그 | `logs/pipeline_YYYYMMDD_HHMMSS.log` (매시간) |
| 백업 cron 로그 | `logs/backup_db.log` |
| ops-bot 스크립트 | `~/app/ops-bot/scripts/` |
| ops-bot 환경변수 | `~/app/attendance/ops-bot/.env` |
| DB 백업 | `/mnt/nas/attendance/backups/attendance_YYYYMMDD_HHMMSS.sql.gz` |
| 백업 보존 | 30일 자동 삭제 |
| 장애 기록 | `docs/INCIDENT_JWT_AUTH_2026-04-04.md` |
| 운영 런북 | `docs/OPS_RUNBOOK_2026-04-04.md` |

---

## cron 등록 현황

| 주기 | 스크립트 | 로그 |
|------|----------|------|
| `*/5 * * * *` | `scheduled_check.sh --quick` | `logs/scheduled_check.log` |
| `0 * * * *` | `scheduled_check.sh --full` | `logs/scheduled_check.log` |
| `0 2 * * *` | `backup_db.sh db` | `logs/backup_db.log` |

---

## 후순위 backlog

→ `docs/BACKLOG_OPS_2026-04-04.md` 참조
