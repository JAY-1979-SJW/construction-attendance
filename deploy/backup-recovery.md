# 해한 현장 출퇴근 — 백업/복구 운영 기준

> 작성 기준: 2026-03-26
> 인프라: 앱 서버 1대(1.201.176.236) + 공용 DB(192.168.120.18) + NAS(/mnt/nas/attendance)
> OCR 미설정 상태는 정상 운영으로 간주

---

## 1. 백업 경로

```
/mnt/nas/attendance/backups/
    db/
        daily/    attendance_daily_YYYYMMDD_HHmmss.sql.gz   (14일 보관)
        manual/   attendance_manual_YYYYMMDD_HHmmss.sql.gz  (90일 보관)
```

| 경로 | 용도 | 보관 |
|------|------|------|
| `backups/db/daily/` | 자동 야간 백업 | 14일 |
| `backups/db/manual/` | 마이그레이션 전·장애 전 수동 백업 | 90일 |

파일 저장 백업(신분증, 서류, 사진)은 NAS 자체 파일 시스템으로 유지된다.
별도 rsync/복제 없이 NAS 장치가 단일 저장소 역할을 한다.

---

## 2. 백업 스크립트 / 자동화

### 스크립트 위치

```
/home/ubuntu/app/scripts/backup-attendance-db.sh
```

- DB 접속 정보: `/home/ubuntu/app/attendance/.env.production`의 `DATABASE_URL` 파싱
- 비밀번호 별도 파일 불필요 (스크립트 내 하드코딩 없음)
- pg_dump 경로: `/usr/lib/postgresql/15/bin/pg_dump`

### cron (매일 03:15 자동 실행)

```
15 3 * * * /home/ubuntu/app/scripts/backup-attendance-db.sh daily >> /home/ubuntu/logs/attendance/backup.log 2>&1
```

### 로그 경로

```
/home/ubuntu/logs/attendance/backup.log
```

---

## 3. 수동 백업 방법

### 일반 수동 백업

```bash
ssh -i ~/.ssh/haehan-ai.pem ubuntu@1.201.176.236
/home/ubuntu/app/scripts/backup-attendance-db.sh manual
```

### 마이그레이션 전 백업 (반드시 실행)

```bash
# 1. 수동 백업 실행
/home/ubuntu/app/scripts/backup-attendance-db.sh manual

# 2. 백업 파일 확인
ls -lh /mnt/nas/attendance/backups/db/manual/ | tail -3

# 3. 파일 크기 정상 여부 확인 (0바이트면 백업 실패)
# 정상: 수 MB 이상
```

---

## 4. DB 복구 절차

### 상황 1: DB 데이터 손상 또는 잘못된 데이터 반영

```bash
# ① 앱 컨테이너 중단 (복구 중 신규 쓰기 차단)
ssh -i ~/.ssh/haehan-ai.pem ubuntu@1.201.176.236
cd ~/app/attendance
docker compose down

# ② 복구할 백업 파일 선택
ls -lh /mnt/nas/attendance/backups/db/daily/
ls -lh /mnt/nas/attendance/backups/db/manual/
# 가장 최근 파일 또는 장애 직전 파일 선택

# ③ 기존 DB 데이터 삭제 및 복구
# (DB 서버에서 실행하거나 아래처럼 앱 서버에서 원격 실행)
BACKUP_FILE=/mnt/nas/attendance/backups/db/daily/attendance_daily_YYYYMMDD_HHmmss.sql.gz

# DB 비우기 (스키마 유지)
PGPASSWORD=$(grep DATABASE_URL ~/app/attendance/.env.production | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|') \
  psql -h 192.168.120.18 -U attendance_app -d construction_attendance \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 복구 실행
zcat "$BACKUP_FILE" | \
  PGPASSWORD=$(grep DATABASE_URL ~/app/attendance/.env.production | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|') \
  /usr/lib/postgresql/15/bin/psql -h 192.168.120.18 -U attendance_app -d construction_attendance

# ④ 앱 재시작
docker compose up -d
docker logs attendance --tail=30
```

**주의:**
- `DROP SCHEMA` 전 반드시 백업 파일 존재/크기 확인
- Prisma 마이그레이션 테이블(`_prisma_migrations`)도 복구됨 → 재시작 시 `MIGRATE_ON_START=true`이면 이미 적용된 마이그레이션은 스킵됨

---

### 상황 2: 파일 실수 삭제 (신분증 이미지, 서류 등)

NAS 파일은 별도 자동 복제가 없다.

```bash
# 현재 파일 목록 확인
ls /mnt/nas/attendance/uploads/
ls /mnt/nas/attendance/identity/
ls /mnt/nas/attendance/documents/

# DB에서 해당 파일의 저장 경로 확인
PGPASSWORD=... psql -h 192.168.120.18 -U attendance_app -d construction_attendance \
  -c "SELECT id, \"originalFileKey\", \"maskedFileKey\" FROM \"WorkerIdentityDocument\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

복구 방법:
- **NAS 장치 자체 스냅샷**: NAS 관리 콘솔(192.168.120.12 또는 .15)에서 스냅샷 복원
- **스냅샷 미설정 시**: 파일 복구 불가. DB에서 해당 레코드 `scanStatus='FAILED'`로 업데이트 후 재업로드 요청

```bash
# 파일 없는 레코드 복구 불가 처리 (관리자 재업로드 요청)
PGPASSWORD=... psql -h 192.168.120.18 -U attendance_app -d construction_attendance \
  -c "UPDATE \"WorkerIdentityDocument\" SET \"scanStatus\"='FAILED' WHERE id='<id>';"
```

**→ NAS 스냅샷 설정 권고** (현재 미확정 — 7번 항목 참고)

---

### 상황 3: 앱 서버 재기동/재배포

코드나 DB는 정상이고 컨테이너만 내려간 경우:

```bash
ssh -i ~/.ssh/haehan-ai.pem ubuntu@1.201.176.236
cd ~/app/attendance

# 재시작만 필요한 경우
docker compose restart

# 최신 코드 반영 포함
git pull origin master
docker compose build --no-cache
docker compose down && docker compose up -d

# 기동 확인
docker logs attendance --tail=30
# 정상 시: "✓ Ready in Xms" 출력
# 마이그레이션: "All migrations have been successfully applied." 출력
```

**재배포 체크리스트:**
1. NAS 마운트 확인: `ls /mnt/nas/attendance/uploads/`
2. DB 연결 확인: `docker logs attendance --tail=5`
3. 헬스체크: `curl -s http://localhost:3002/api/health`

---

## 5. 파일 복구 절차 요약

| 상황 | 복구 방법 | 가능 여부 |
|------|-----------|-----------|
| NAS 파일 실수 삭제 | NAS 스냅샷 복원 | NAS 스냅샷 설정 필요 |
| NAS 마운트 해제 | 서버 재마운트 | 즉시 가능 |
| 컨테이너 재시작 | `docker compose up -d` | 즉시 가능 |
| DB 데이터 손상 | pg_dump 복구 | 즉시 가능 |

### NAS 재마운트 (NAS 장애 복구 후)

```bash
sudo mount -t nfs 192.168.120.12:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6 /mnt/nas/attendance
# 재마운트 후 컨테이너 재시작 필수
cd ~/app/attendance && docker compose restart
```

---

## 6. 운영 주의사항

| 항목 | 주의 내용 |
|------|-----------|
| 마이그레이션 전 | 반드시 `backup-attendance-db.sh manual` 실행 후 진행 |
| App Server B 추가 시 | `.env.production`에 `MIGRATE_ON_START=false` 설정 필수 |
| NAS 미마운트 상태 | 앱 재시작 금지 — 파일 업로드/다운로드 전체 실패 |
| DB 비밀번호 | `/home/ubuntu/app/attendance/.env.production`에만 보관 |
| SSH 키 | `~/.ssh/haehan-ai.pem` — 분실 시 NHN Cloud 콘솔에서 재발급 |
| cron 실패 확인 | `tail -50 /home/ubuntu/logs/attendance/backup.log` |
| 백업 파일 0바이트 | pg_dump 연결 실패 또는 권한 문제 → 수동 재실행 후 확인 |

---

## 7. 미확정 항목

| 항목 | 현재 상태 | 권고 |
|------|-----------|------|
| NAS 스냅샷 | 미설정 | NAS 관리 콘솔(192.168.120.12)에서 일별 스냅샷 활성화 권고 |
| App Server B | IP 미정 | 추가 시 cron은 A 서버에만 유지, B는 백업 제외 |
| 백업 알림 | 미설정 | 기존 `notify.sh` 연동 가능 (ops.env에 Slack/Discord webhook 설정 시) |
| DB 서버 직접 pg_dump | 미구성 | DB 서버에 SSH 접속 가능하면 로컬 pg_dump가 더 안정적 |
| 파일 이중화 | 미구성 | NAS 이중화 경로(192.168.120.15) rsync 주기 복제 검토 가능 |
