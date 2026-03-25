# 서버 접속 정보

## 1. 출퇴근 앱 (App Server A — 해한-mcp)
- 도메인: attendance.haehan-ai.kr
- 공인 IP: 1.201.176.236
- 내부 IP: 192.168.120.8
- SSH 계정: ubuntu
- SSH 키 파일: haehan-ai.pem (키페어 이름: 해한아이)
- 앱 경로: ~/app/attendance/
- 배포 방식: Docker Compose
- 앱 포트: 3002
- DB 서버: 192.168.120.18
- DB 이름: construction_attendance
- 관리자 계정: admin@haehan.com

## 1-1. DB 서버 (해한 웹DB)
- 공인 IP: 1.201.177.67
- 내부 IP: 192.168.120.18
- SSH 계정: ubuntu
- SSH 키 파일: haehan-ai.pem (키페어 이름: 해한아이)
- 스펙: 4Core 8GB / Ubuntu 22.04
- 보안그룹 5432: 192.168.120.8/32 (앱 서버 내부 IP) 만 허용

## 1-2. NAS (해한아이나스)
- NAS 이름: 해한아이나스
- 프로토콜: NFS / 용량: 2,000GB
- 상태: 사용 가능
- NFS 경로 1: 192.168.120.12:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6
- NFS 경로 2: 192.168.120.15:/share_d43bb7fa_74a8_496f_8fe0_b1bd37b437d6
- 앱 서버 마운트 포인트: /mnt/nas/attendance

## 2. 입찰 앱
- 도메인: bid.haehan-ai.kr
- 서버 IP: 운영값 확인 후 입력
- SSH 계정: 운영값 확인 후 입력
- SSH 키 파일: 운영값 확인 후 입력
- 앱 경로: 운영값 확인 후 입력
- 배포 방식: Docker Compose 여부 확인 후 입력

## 3. 비밀번호/시크릿 저장 위치
- 앱 런타임 환경변수: ~/app/.env
- DB 관리자 시크릿 디렉터리: ~/.secrets/db/
- DB 관리자 비밀번호 파일: ~/.secrets/db/.env.admin
- 운영 규칙 문서: ~/.secrets/db/README.md

## 4. 원칙
- 비밀번호 값 자체를 일반 문서에 직접 적지 않는다.
- 비밀번호는 .env 또는 전용 secrets 경로에만 저장한다.
- 웹, 백엔드, DB 접속 정보는 분리 관리한다.
