# 독립형 수산시장 소매점 주문관리 SaaS

이 폴더는 기존 `노량진 활어 시세` 프로젝트와 분리해서 진행하는 신규 작업 공간입니다.

## 목표

- 오픈카톡을 통해 유입되는 주문을 체계적으로 접수
- 입금 확인, 손질, 직접 픽업, 퀵, 택배 관리를 한 화면에서 처리
- 수산시장 소매점이 바로 돈을 내고 쓸 수 있는 운영 도구로 설계

## 범위

- 기존 시세 앱과 기능, 데이터, 브랜딩을 연결하지 않음
- 별도 제품으로 MVP, 화면 구성, 제안 문안을 설계

## 다음 스레드에서 진행할 순서

1. `docs/MVP_SPEC.md`
2. `docs/SCREEN_PLAN.md`
3. `docs/IMPLEMENTATION_BLUEPRINT.md`
4. `docs/IMPLEMENTATION_ROADMAP.md`
5. `docs/PRODUCT_BACKLOG.md`
6. `docs/KAKAOTALK_INSIGHTS.md`
7. `docs/STATE_DICTIONARY.md`
8. `docs/DB_SCHEMA.md`
9. `docs/API_SPEC.md`
10. `docs/WIREFRAMES.md`
11. `docs/FULFILLMENT_OPERATIONS.md`
12. `docs/SALES_PITCH.md`
13. `docs/HALF_ORDER_MATCHING.md`
14. `docs/AUTO_DEPOSIT_CONFIRMATION.md`
15. `docs/SERVICE_STRATEGY_AUDIT.md`

## 시작 문서

- `NEXT_THREAD_PROMPT.md`: 새 스레드 시작용 요약

## 코드 스캐폴딩

- `package.json`: TypeScript + Express 백엔드 기본 설정
- `src/app.ts`: Express 앱 구성
- `src/server.ts`: 서버 시작점
- `src/modules/`: 도메인별 API 라우트 스켈레톤
- `db/migrations/001_initial_schema.sql`: 첫 PostgreSQL 마이그레이션 초안

## 실행 준비

1. `npm install`
2. `.env.example`과 `web/.env.example`을 참고해 환경값 정리
3. API 서버 실행: `npm run dev:api`
4. 웹 프론트 실행: `npm run dev:web`

현재는 Express API와 React 웹을 분리해서 개발하고, `npm run build` 후에는 API 서버가 `web/dist`를 함께 서빙한다.

## 시각 프로토타입

- `prototype/index.html`: 고객 화면과 관리자 화면을 한 번에 볼 수 있는 정적 HTML 시안
- `prototype/styles.css`: 프로토타입 전용 스타일

## 실제 웹 앱

- `web/src/`: React + Vite 기반 고객/관리자 웹 앱
- `web/src/pages/`: 홈, 고객 주문, 주문 조회, 관리자 대시보드, 주문 상세
- `web/src/lib/api.ts`: 기존 Express API 연결 클라이언트
- 관리자 화면은 하단 `운영자 전용` 버튼에서 운영 토큰 입력, 또는 `/admin/dashboard?adminToken=...` 방식으로 진입
- `npm run check`: API + 웹 타입체크
- `npm run build`: API + 웹 빌드

## 상세 기능 설계 문서

- `docs/SERVICE_STRATEGY_AUDIT.md`: 서비스 구조 재정의, 고객가치 관점 문제점, 우선 보완안
- `docs/DEPLOYMENT_GUIDE.md`: Render + Supabase 기준 배포 가이드
- `docs/ORACLE_SERVER_DEPLOYMENT.md`: 오라클 서버 + GitHub Actions 자동 배포 가이드
- `docs/IMPLEMENTATION_BLUEPRINT.md`: 구현 기준과 모듈 구조
- `docs/IMPLEMENTATION_ROADMAP.md`: 단계별 구현 로드맵
- `docs/PRODUCT_BACKLOG.md`: 우선순위 기반 기능 백로그
- `docs/KAKAOTALK_INSIGHTS.md`: 카카오톡 대화 기반 현장 요구 분석
- `docs/KAKAOTALK_CORE_FEATURES_20260420.md`: 2026-04-20 카톡 로그 기반 소비자/운영자 핵심 기능 재정의
- `docs/STATE_DICTIONARY.md`: 주문/입금/출고/매칭 상태 사전
- `docs/DB_SCHEMA.md`: PostgreSQL 기준 DB 스키마 명세
- `docs/API_SPEC.md`: 고객용/관리자용 API 명세
- `docs/WIREFRAMES.md`: 고객/관리자 화면 와이어프레임
- `docs/FULFILLMENT_OPERATIONS.md`: 직접 픽업, 퀵, 택배 운영 설계
- `docs/HALF_ORDER_MATCHING.md`: 반절 주문 매칭 기능 상세 설계
- `docs/AUTO_DEPOSIT_CONFIRMATION.md`: 자동 입금확인 기능 상세 설계
