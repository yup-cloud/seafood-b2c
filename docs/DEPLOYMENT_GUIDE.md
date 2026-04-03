# 배포 가이드

## 1. 목표

이 가이드는 현재 프로젝트를 `언제 어디서나 접속 가능한 데모 웹앱`으로 배포하기 위한 기준 문서다.

현재 구조는 아래와 같다.

- React 웹앱을 `web/dist`로 빌드
- Express API가 빌드된 웹 정적 파일을 함께 서빙
- PostgreSQL 연결 필요

즉 프론트와 API를 따로 나누지 않고 `하나의 Node 서비스`로 배포하는 방식이 가장 단순하다.

## 2. 권장 배포 구조

### 앱 서버

- `Render Web Service`
- 장점:
  - Node 앱 배포가 단순함
  - Git 연동과 자동 배포가 쉬움
  - Express + 정적 웹 동시 서빙 구조와 잘 맞음

### 데이터베이스

- `Supabase Postgres`
- 장점:
  - PostgreSQL 사용이 쉬움
  - 초기 데모와 MVP 운영에 충분함
  - 연결 문자열 관리가 단순함

## 3. 왜 이 구조를 추천하는가

- 지금 프로젝트는 이미 `npm run build` 후 `npm start`만으로 웹과 API가 같이 뜬다.
- 그래서 별도 프론트 호스팅을 붙일 필요 없이 한 서비스로 끝낼 수 있다.
- 데모 링크를 빠르게 만들기 좋고, 제안용 화면 확인에도 편하다.

## 4. 배포 전 준비

### 필수 확인

- `npm run check`
- `npm run build`

둘 다 통과한 뒤 배포하는 것을 권장한다.

### 필요한 계정

- Git 저장소
- Render 계정
- Supabase 계정

## 5. Supabase 준비

1. 새 프로젝트 생성
2. 데이터베이스 비밀번호 설정
3. `Connection string` 복사
4. 현재 프로젝트의 스키마를 Supabase에 반영

반영 기준:

- `db/migrations/001_initial_schema.sql`

## 6. Render 준비

이 저장소 루트에는 `render.yaml`이 포함되어 있다.

핵심 설정:

- 빌드 명령: `npm install && npm run build`
- 시작 명령: `npm start`
- 헬스체크: `/api/v1/health`

## 7. Render 환경변수

반드시 넣어야 하는 값:

- `DATABASE_URL`

기본 데모값으로 들어가 있는 값:

- `STORE_NAME`
- `STORE_PRIMARY_PHONE`
- `STORE_SECONDARY_PHONE`
- `STORE_BANK_NAME`
- `STORE_BANK_ACCOUNT`
- `STORE_BANK_HOLDER`
- `STORE_ADDRESS_LINE1`
- `STORE_ADDRESS_LINE2`
- `STORE_BUSINESS_HOURS_NOTE`

실제 제안용 링크로 쓸 때는 업체 정보 대신 중립적인 데모값을 유지하는 것을 권장한다.

## 8. 실제 배포 순서

1. Git 저장소에 코드 업로드
2. Supabase에서 DB 생성
3. Render에서 `Blueprint` 또는 `New Web Service` 생성
4. 저장소 연결
5. `DATABASE_URL` 입력
6. 첫 배포 실행
7. 배포 후 `/api/v1/health` 확인
8. 메인 URL 접속 후 고객/관리자 화면 확인

## 9. 배포 후 확인할 것

### 고객 화면

- 홈 화면 진입
- 주문서 열림
- 주문 상태 조회 열림

### 관리자 화면

- `/admin/dashboard?adminToken=oneulbada-ops-2026`
- 대시보드 열림
- 카톡 공지 생성기 동작

### API

- `/api/v1/health`
- DB reachable 여부 확인

## 10. 현재 단계의 한계

- 결제 연동은 아직 실배포 수준으로 연결되지 않았다.
- 관리자 인증은 운영 토큰 기반 데모 수준이다.
- 실제 서비스 오픈 전에는 인증, 보안, 로깅, 백업 정책을 더 강화해야 한다.

## 11. 권장 다음 단계

1. 데모 링크용 Render 배포
2. Supabase에 마이그레이션 반영
3. 관리자 토큰 교체
4. 제안용 데모 URL 고정
