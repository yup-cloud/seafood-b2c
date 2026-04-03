# 오라클 서버 자동 배포 가이드

## 1. 목적

이 문서는 현재 프로젝트를 `오라클 서버 + GitHub Actions SSH 배포` 방식으로 운영하기 위한 기준 문서다.

기존 참고 프로젝트와 동일한 흐름을 따르도록 구성한다.

- `main` 푸시
- GitHub Actions에서 타입체크/빌드
- SSH로 서버 접속
- 서버의 `~/deploy-seafood-b2c.sh` 실행

## 2. 현재 추가된 파일

- `.github/workflows/ci.yml`
- `scripts/deploy-seafood-b2c.sh.example`

## 3. GitHub Secrets

GitHub 저장소 `Settings > Secrets and variables > Actions`에 아래 값을 추가한다.

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

Secrets가 없으면 GitHub Actions는 테스트와 빌드까지만 수행하고 실제 배포는 건너뛴다.

## 4. 서버 준비

서버에 아래 경로로 프로젝트가 체크아웃되어 있어야 한다.

```bash
~/seafood-b2c
```

필수 설치:

- Node.js 20
- npm
- PostgreSQL client (`psql`) 필요 시
- systemd 서비스 등록

## 5. 서버 배포 스크립트

서버 홈 경로에 아래 이름으로 스크립트를 둔다.

```bash
~/deploy-seafood-b2c.sh
```

기본 템플릿은 아래 파일을 참고한다.

- `scripts/deploy-seafood-b2c.sh.example`

권장 권한:

```bash
chmod +x ~/deploy-seafood-b2c.sh
```

## 6. systemd 서비스 예시

```ini
[Unit]
Description=seafood b2c demo app
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/seafood-b2c
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/home/ubuntu/seafood-b2c/.env

[Install]
WantedBy=multi-user.target
```

서비스 이름은 예시로 `seafood-b2c`를 사용한다.

## 7. 환경변수 파일

운영 서버에는 `.env.production` 또는 `.env`를 준비한다.

예시:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME
STORE_NAME=오늘바다 데모점
STORE_PRIMARY_PHONE=010-1234-5678
STORE_SECONDARY_PHONE=010-2345-6789
STORE_BANK_NAME=신한은행
STORE_BANK_ACCOUNT=110-123-456789
STORE_BANK_HOLDER=오늘바다
STORE_ADDRESS_LINE1=서울시 동작구 예시로 123 수산타운 1층
STORE_ADDRESS_LINE2=A동 12호
STORE_BUSINESS_HOURS_NOTE=월~금 05:00~17:00 / 토 05:00~18:00 / 일 06:00~17:00
```

## 8. 배포 흐름

1. 로컬에서 코드 수정
2. `main` 브랜치 푸시
3. GitHub Actions가 `npm install`, `npm run check`, `npm run build` 수행
4. 성공 시 서버의 `~/deploy-seafood-b2c.sh` 실행
5. 서버에서 pull, install, build, 서비스 재시작

## 9. 운영 확인

배포 후 확인 항목:

- 메인 URL 접속
- `/api/v1/health`
- 고객 주문서
- 관리자 대시보드
- 카톡 공지 생성기

## 10. 주의사항

- 현재 마이그레이션은 `001_initial_schema.sql` 한 개만 있다.
- 스키마 변경이 생기면 SQL 파일을 누적 관리하는 방식으로 운영하는 것이 안전하다.
- 운영 토큰과 DB 접속 문자열은 반드시 GitHub Secrets 또는 서버 환경변수로 관리한다.
