# 해한 현장 출퇴근 시스템 - 설치 및 실행 방법

## 필요 조건
- Node.js 18+
- PostgreSQL 14+
- npm 또는 yarn

## 설치

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 열어 DATABASE_URL 등 필수 값 입력
```

### 3. DB 마이그레이션
```bash
npx prisma migrate dev --name init
```

### 4. 초기 데이터 생성 (관리자 계정 + 샘플 현장)
```bash
npm run db:seed
```

### 5. 개발 서버 실행
```bash
npm run dev
```

→ http://localhost:3000 접속

## 기본 계정

| 구분 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@haehan.com | admin1234 |

> 운영 시 `ADMIN_INITIAL_PASSWORD` 환경변수로 변경

## 주요 URL

| 경로 | 설명 |
|------|------|
| `/` | 근로자 로그인 (→ /login 리다이렉트) |
| `/login` | 휴대폰 번호 입력 |
| `/login/verify` | OTP 인증번호 입력 |
| `/device/register` | 기기 등록 |
| `/qr/[qrToken]` | QR 스캔 후 출퇴근 |
| `/attendance` | 오늘 출퇴근 현황 |
| `/admin` | 관리자 대시보드 |
| `/admin/login` | 관리자 로그인 |
| `/admin/workers` | 근로자 관리 |
| `/admin/sites` | 현장 관리 |
| `/admin/attendance` | 출퇴근 조회 + 엑셀 다운로드 |
| `/admin/exceptions` | 예외 승인 |
| `/admin/device-requests` | 기기 변경 승인 |

## SMS 설정

`.env`에서 `SMS_MODE` 설정:
- `mock`: 콘솔에 OTP 출력 (개발용) — 기본값
- `coolsms`: CoolSMS 연동 (별도 SDK 설치 필요)
- `ncloud`: NCloud SENS 연동

## QR코드 생성

관리자 > 현장 관리에서 현장 등록 시 QR URL이 발급됩니다.
해당 URL을 QR코드 생성 사이트(예: qr.io, qrserver.com)에서
QR이미지로 변환 후 현장에 출력하여 부착하세요.

예시 URL: `https://your-domain.com/qr/{qrToken}`

## 확장 포인트

- **SMS 실연동**: `lib/sms/sms-provider.ts`의 `sendViaCoolSms` 또는 `sendViaNCloud` 구현
- **QR 이미지 자동생성**: `lib/qr/qr-image.ts`에 qrcode 라이브러리 연동
- **푸시알림**: FCM 또는 Web Push API 연동
- **급여 연동**: `lib/attendance/` 기반 월별 집계 → 외부 급여 API 연동
- **다중 관리자**: `AdminRole` enum 활용하여 권한별 UI 분기
- **현장 비활성화 API**: `PATCH /api/admin/sites/[id]` 추가
- **근로자 수정 API**: `PUT /api/admin/workers/[id]` 추가
