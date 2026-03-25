# 인프라 구조 문서

## 현재 구조 (단일 서버)

```
[클라이언트]
    ↓ HTTPS
[Nginx + 앱 + DB — 1.201.176.236]
    └── PostgreSQL (컨테이너, 로컬)
    └── 업로드 파일 (로컬 named volume)
```

문제:
- DB와 앱이 같은 서버에 공존 → 서버 추가 시 DB 분리 불가
- 업로드 파일이 서버 로컬 → 2대 운영 시 파일 불일치

---

## 권장 구조 (2대 + 공용 DB + NAS)

```
[클라이언트]
    ↓ HTTPS
[Nginx 로드밸런서]
    ├── App Server A  1.201.176.236:3002
    └── App Server B  <미정>:3002
            ↓ (공통)
    [DB Server — 192.168.120.18:5432]  PostgreSQL 전용
            ↓ (공통)
    [NAS — <미정>]  업로드/서류/백업
```

---

## 역할 분리

| 구성 요소 | 역할 | 상태 |
|-----------|------|------|
| App Server A | 웹/백엔드 실행, 마이그레이션 기준 서버 | 운영 중 |
| App Server B | 웹/백엔드 실행 | 미설정 |
| DB Server | PostgreSQL 전용 (construction_attendance) | 운영 중 |
| NAS | 업로드 파일, 서류, 보고서, 백업 | 미연결 |
| Redis | 세션/캐시 (선택, 현재 JWT 쿠키로 대체 중) | 미설치 |

---

## 출퇴근 앱 확정 정보

| 항목 | 값 |
|------|-----|
| 도메인 | attendance.haehan-ai.kr |
| App Server A IP | 1.201.176.236 |
| SSH 계정 | ubuntu |
| 앱 경로 | ~/app/attendance/ |
| DB 서버 | 192.168.120.18 |
| DB 이름 | construction_attendance |
| 앱 포트 | 3002 |

---

## NAS 저장 대상

```
/attendance/
    uploads/          근로자 신원증명, 출퇴근 사진
    documents/        4대보험 제출 서류, 계약서
    reports/          작업일보, 엑셀/PDF 산출물
    backups/          DB 덤프 (pg_dump 결과)
    log-archive/      앱 로그 장기 보관
```

NAS에 두지 않는 것:
- PostgreSQL 본 DB 데이터 (`pgdata/`) → DB 서버 로컬 디스크
- 세션 파일 → JWT 쿠키 또는 Redis
- 실시간 트랜잭션 데이터

---

## 운영 원칙

**DB 연결**
- 앱 서버 2대 모두 동일한 `DATABASE_URL` 사용
- `DATABASE_URL=postgresql://...@192.168.120.18:5432/construction_attendance`
- 서버별 로컬 DB 사용 금지

**마이그레이션**
- App Server A에서만 실행 (`MIGRATE_ON_START=true`)
- App Server B는 `MIGRATE_ON_START=false`
- 배포 순서: App Server A 재시작 → 마이그레이션 완료 확인 → App Server B 재시작

**파일 업로드**
- 앱 서버 로컬 디스크에 저장 금지
- NAS 마운트 또는 오브젝트 스토리지(MinIO/S3) 기준으로 저장
- 현재 로컬 named volume 사용 중 → NAS 연결 전까지 서버 1대 운영 유지

**비밀번호**
- 문서 본문에 값 기록 금지
- 저장 위치: `~/app/.env` (앱), `~/.secrets/db/.env.admin` (DB 관리자)

**방화벽**
- DB 서버(192.168.120.18) 5432 포트: 앱 서버 IP만 허용, 외부 차단
- NAS: 앱 서버 내부망에서만 마운트

---

## 주의사항

| 항목 | 현재 상태 | 조치 필요 |
|------|-----------|-----------|
| 업로드 파일 공유 | 로컬 volume (서버별 분리) | NAS 마운트 또는 MinIO 전환 |
| App Server B | 미설정 | IP 확정 후 docker-compose 배포 |
| NAS | 미연결 | IP 확정 후 NFS 마운트 설정 |
| Redis | 미설치 | 세션 부하 증가 시 도입 |
| DB 방화벽 | 미확인 | 앱 서버 IP 외 차단 확인 필요 |
