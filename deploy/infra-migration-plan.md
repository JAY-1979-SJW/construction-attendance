# 인프라 전환 실행안 (출퇴근 앱 기준)

## 서버 구성 (확정)

| 서버명 | 공인 IP | 내부 IP | 역할 |
|--------|---------|---------|------|
| 해한-mcp (App Server A) | 1.201.176.236 | 192.168.120.8 | 출퇴근 앱 실행 |
| 해한 웹DB (DB Server) | 1.201.177.67 | 192.168.120.18 | PostgreSQL 전용 |
| App Server B | 미정 | 미정 | 출퇴근 앱 실행 (추가 예정) |
| 해한아이나스 (NAS) | NFS, 2TB | - | 파일 저장소 (마운트 경로 미확정) |

**보안그룹 현황 (DB 서버)**
- 5432 inbound: `192.168.120.8/32` 만 허용 (App Server A 내부 IP) → 올바르게 구성됨
- App Server B 추가 시: B의 내부 IP를 5432 inbound에 추가 필요
- 80/443 ALL OPEN: DB 전용 서버로 전환 후 제거 검토 필요

---

## 1. 현재 로컬 의존 항목

### 1-1. 파일 저장 경로 하드코딩 (환경변수 없음)

| 파일 | 코드 | 문제 |
|------|------|------|
| `lib/storage/identity-storage.ts:5` | `path.join(process.cwd(), 'uploads', 'identity')` | 환경변수 없음, 하드코딩 |
| `lib/storage/document-storage.ts:5` | `path.join(process.cwd(), 'uploads', 'documents')` | 환경변수 없음, 하드코딩 |

### 1-2. 환경변수 있으나 기본값이 로컬 경로

| 파일 | 환경변수 | 기본값 |
|------|----------|--------|
| `app/api/attendance/photo/upload/route.ts` | `UPLOAD_DIR` | `/app/uploads/attendance-photos` |
| `app/api/admin/workers/[id]/temp-docs/route.ts` | `UPLOAD_DIR` | `/app/uploads` |

### 1-3. Docker named volume (서버 로컬)

```yaml
# docker-compose.yml
volumes:
  identity_uploads:    # → /app/uploads/identity  (로컬)
  documents_uploads:   # → /app/uploads/documents (로컬)
```

출퇴근 사진(`attendance-photos`)과 임시서류(`temp-sensitive`)는 볼륨 마운트조차 없어 컨테이너 내부에만 존재.

### 1-4. Dockerfile 내 mkdir (빌드 시 로컬 경로 고정)

```dockerfile
RUN mkdir -p /app/uploads/identity/original /app/uploads/identity/masked \
              /app/uploads/documents /app/uploads/estimates
```

### 1-5. 파일 서빙 방식 확인

파일 다운로드는 전부 API 경유 (직접 static 서빙 없음).
DB에는 상대 경로만 저장됨 → NAS 전환 시 경로 prefix만 바꾸면 됨.

| 서빙 라우트 | 읽는 저장소 |
|-------------|-------------|
| `/api/admin/identity-documents/[id]/file` | `lib/storage/identity-storage.ts` |
| `/api/admin/attendance/photos/[id]/file` | `UPLOAD_DIR` |
| `/api/admin/workers/[id]/documents/[id]/download` | `lib/storage/document-storage.ts` |
| `/api/admin/workers/[id]/temp-docs/[id]/download` | `UPLOAD_DIR` |

---

## 2. DB 분리 필요 항목

### 이미 수정됨 (코드 반영 완료, 서버 미반영)

| 파일 | 변경 내용 |
|------|-----------|
| `docker-compose.yml` | `attendance-db` 컨테이너 제거, `pgdata` 볼륨 제거 |
| `entrypoint.sh` | `MIGRATE_ON_START` env guard 추가 |
| `.env.production` | `DATABASE_URL` → `192.168.120.18:5432` 변경, `MIGRATE_ON_START=true` 추가 |

### 서버에서 남은 작업

```bash
# 1. 서버에서 DB 연결 가능 여부 확인 (사전 검증)
nc -z 192.168.120.18 5432

# 2. 기존 DB 백업 (전환 전 필수)
docker exec attendance_db pg_dump -U postgres construction_attendance \
  > ~/backups/construction_attendance_$(date +%Y%m%d_%H%M).sql

# 3. 코드 반영 후 재시작
cd ~/app/attendance
git pull origin master
docker compose down && docker compose up -d

# 4. 마이그레이션 실행 확인 (App Server A 로그 확인)
docker logs attendance --tail=30
```

### App Server B 추가 시 .env.production 차이점

| 항목 | App Server A | App Server B |
|------|-------------|-------------|
| `DATABASE_URL` | `192.168.120.18:5432` 동일 | `192.168.120.18:5432` 동일 |
| `MIGRATE_ON_START` | `true` | `false` |
| 나머지 | 동일 | 동일 |

---

## 3. NAS 연동 필요 항목

### 코드 수정 대상: 환경변수화 필요

**`lib/storage/identity-storage.ts`**
```typescript
// 현재 (하드코딩)
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'identity')

// 변경 후
const UPLOAD_ROOT = process.env.UPLOAD_ROOT_IDENTITY ?? path.join(process.cwd(), 'uploads', 'identity')
```

**`lib/storage/document-storage.ts`**
```typescript
// 현재 (하드코딩)
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'documents')

// 변경 후
const UPLOAD_ROOT = process.env.UPLOAD_ROOT_DOCUMENTS ?? path.join(process.cwd(), 'uploads', 'documents')
```

### 환경변수 추가 목록

| 환경변수 | 현재 기본값 | NAS 설정값 |
|----------|-------------|------------|
| `UPLOAD_ROOT_IDENTITY` | `<process.cwd()>/uploads/identity` | `/mnt/nas/attendance/identity` |
| `UPLOAD_ROOT_DOCUMENTS` | `<process.cwd()>/uploads/documents` | `/mnt/nas/attendance/documents` |
| `UPLOAD_DIR` | `/app/uploads` | `/mnt/nas/attendance/uploads` |

### docker-compose.yml volumes 변경

```yaml
# 현재 (named volume, 로컬)
volumes:
  - identity_uploads:/app/uploads/identity
  - documents_uploads:/app/uploads/documents

# NAS 적용 후 (bind mount, NFS 마운트 경로)
volumes:
  - /mnt/nas/attendance/identity:/app/uploads/identity
  - /mnt/nas/attendance/documents:/app/uploads/documents
  - /mnt/nas/attendance/uploads:/app/uploads   # 사진, 임시서류 포함
```

### NAS 디렉토리 구조

```
/mnt/nas/attendance/
    identity/
        original/{year}/{month}/
        masked/{year}/{month}/
    documents/{workerId}/{year}/{month}/
    uploads/
        attendance-photos/{yyyy-mm}/
        temp-sensitive/{workerId}/
    reports/
    backups/
    log-archive/
```

---

## 4. 실제 수정 대상 파일 목록

### Phase 1: DB 분리 (즉시 실행 가능)

| 파일 | 상태 | 서버 반영 필요 |
|------|------|---------------|
| `docker-compose.yml` | 수정 완료 | 예 |
| `entrypoint.sh` | 수정 완료 | 예 |
| `.env.production` | 수정 완료 | 예 |

### Phase 2: NAS 연동 (NAS IP 확정 후)

| 파일 | 변경 내용 |
|------|-----------|
| `lib/storage/identity-storage.ts` | `UPLOAD_ROOT` 환경변수화 |
| `lib/storage/document-storage.ts` | `UPLOAD_ROOT` 환경변수화 |
| `.env.production` | `UPLOAD_ROOT_IDENTITY`, `UPLOAD_ROOT_DOCUMENTS`, `UPLOAD_DIR` 추가 |
| `.env.example` | 동일 변수 템플릿 추가 |
| `docker-compose.yml` | named volumes → NFS bind mount 교체 |
| `deploy/server-setup.sh` | NFS 마운트 명령 추가 |

---

## 5. 전환 절차

### Phase 1: DB 분리

```
[1] DB 서버 연결 사전 확인
    nc -z 192.168.120.18 5432
    → 실패 시 DB 서버 방화벽 확인 (앱서버 IP 허용 필요)

[2] 현재 DB 백업
    docker exec attendance_db pg_dump -U postgres construction_attendance > ~/backups/db_$(date +%Y%m%d).sql

[3] git pull (수정된 코드 반영)
    cd ~/app/attendance && git pull origin master

[4] .env.production 확인
    DATABASE_URL 이 192.168.120.18:5432 를 가리키는지 확인
    MIGRATE_ON_START=true 확인

[5] 컨테이너 재시작
    docker compose down && docker compose up -d

[6] 마이그레이션 로그 확인
    docker logs attendance --tail=50 | grep -E "migrat|error|Error"

[7] 기능 점검
    - 로그인 동작 여부
    - 출퇴근 기록 조회
    - 근로자 목록 조회
```

### Phase 2: NAS 연동

NFS 경로 확정:
- `192.168.120.12:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6`
- `192.168.120.15:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6` (이중화 경로)

```
[1] NAS 접근 테스트 (앱 서버에서)
    ping 192.168.120.12
    showmount -e 192.168.120.12

[2] 앱 서버에 NFS 마운트
    sudo apt install nfs-common
    sudo mkdir -p /mnt/nas/attendance
    sudo mount -t nfs 192.168.120.12:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6 /mnt/nas/attendance
    # 영구 등록 (재부팅 유지)
    echo "192.168.120.12:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6 /mnt/nas/attendance nfs defaults,_netdev 0 0" | sudo tee -a /etc/fstab

[3] NAS 디렉토리 구조 생성
    mkdir -p /mnt/nas/attendance/{identity/original,identity/masked,documents,uploads/attendance-photos,uploads/temp-sensitive,reports,backups,log-archive}

[4] 기존 로컬 파일 NAS로 이전
    docker cp attendance:/app/uploads/identity /mnt/nas/attendance/
    docker cp attendance:/app/uploads/documents /mnt/nas/attendance/
    # 또는 docker volume에서 직접 복사

[5] 코드 수정 (identity-storage.ts, document-storage.ts 환경변수화)

[6] .env.production에 경로 변수 추가
    UPLOAD_ROOT_IDENTITY=/mnt/nas/attendance/identity
    UPLOAD_ROOT_DOCUMENTS=/mnt/nas/attendance/documents
    UPLOAD_DIR=/mnt/nas/attendance/uploads

[7] docker-compose.yml volumes → NFS bind mount로 교체

[8] 재빌드 및 재시작
    docker compose build --no-cache && docker compose down && docker compose up -d

[9] 업로드 기능 점검
    - 신분증 업로드 및 다운로드
    - 출퇴근 사진 업로드
    - 근로자 문서 업로드/다운로드
```

---

## 6. 위험 요소

| 위험 | 발생 조건 | 영향 | 대응 |
|------|-----------|------|------|
| DB 연결 실패 | `192.168.120.18:5432` 방화벽 차단 | 앱 전체 중단 | Phase 1 전에 `nc -z` 테스트 필수 |
| 마이그레이션 중복 실행 | App Server B에 `MIGRATE_ON_START=true` 설정 | 마이그레이션 lock 충돌 | B 서버는 반드시 `false` |
| NAS 마운트 해제 | NAS 장애 또는 네트워크 단절 | 파일 업로드/다운로드 전체 실패 | NAS 미연결 상태에서 앱 재시작 금지 |
| 서버 2대 로컬 파일 불일치 | NAS 연동 전에 App Server B 추가 | A 업로드 파일을 B가 서빙 불가 | NAS 연동 완료 전 서버 B 추가 금지 |
| 기존 파일 누락 | NAS 이전 시 docker volume 복사 누락 | 기존 업로드 파일 404 | 이전 전 파일 수 확인, 이전 후 랜덤 샘플 검증 |
| 세션 이슈 | (현재 JWT 쿠키 기반이므로 서버 추가에 무관) | 없음 | 추후 Redis 도입 시 재검토 |

---

## 7. 바로 작업 가능한 것 / 확정이 필요한 것

### 즉시 실행 가능 (값 모두 확정)

| 작업 | 필요한 것 |
|------|-----------|
| Phase 1 DB 분리 배포 | 코드 수정 완료, `.env.production` 수정 완료, 서버 SSH 접속만 하면 됨 |
| DB 서버 방화벽 확인 | SSH 접속 (1.201.176.236) |
| DB 연결 테스트 (`nc -z`) | SSH 접속 (1.201.176.236) |
| 현재 DB 백업 | SSH 접속 (1.201.176.236) |

### 확정 필요 후 진행

| 작업 | 필요한 값 |
|------|-----------|
| NAS 마운트 | NAS IP, NFS export 경로 |
| App Server B 추가 | App Server B IP |
| nginx-lb.conf 적용 | App Server B IP |
| `lib/storage/*.ts` 코드 수정 | NAS 경로 확정 (수정 자체는 바로 가능) |
