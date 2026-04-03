# DB 스키마 명세

## 1. 문서 목적

이 문서는 수산시장 소매점 주문관리 SaaS의 MVP 및 확장 기능을 구현하기 위한 데이터베이스 구조를 정의한다.  
기준 DB는 PostgreSQL을 가정한다.

## 2. 설계 원칙

- 상태값은 문자열 enum 성격 컬럼으로 두되, 앱 레벨에서 상태 사전을 강하게 관리
- 금액은 `numeric(12,2)` 사용
- 고객용 조회는 공개 토큰 기반으로 제한
- 운영 기록은 삭제보다 상태 변경과 감사 로그 우선
- 시세표, 주문, 정산, 입금, 출고, 매칭을 분리된 엔터티로 관리

## 3. 핵심 테이블 목록

- `stores`
- `store_contacts`
- `price_board_batches`
- `price_board_items`
- `processing_rules`
- `orders`
- `order_items`
- `order_quotes`
- `payments`
- `payment_events`
- `bank_transactions`
- `payment_matches`
- `fulfillments`
- `match_groups`
- `match_group_members`
- `order_status_logs`
- `audit_logs`

## 4. 테이블 상세

### 4-1. `stores`

매장 기본 정보 테이블.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 매장 ID |
| name | varchar(120) | not null | 매장명 |
| business_name | varchar(120) | null | 사업자 표기명 |
| owner_name | varchar(80) | null | 대표자명 |
| phone_primary | varchar(30) | null | 대표 연락처 |
| phone_secondary | varchar(30) | null | 보조 연락처 |
| address_line1 | varchar(200) | null | 주소 |
| address_line2 | varchar(200) | null | 상세 주소 |
| bank_name | varchar(80) | null | 입금 은행명 |
| bank_account | varchar(80) | null | 계좌번호 |
| bank_holder | varchar(80) | null | 예금주 |
| business_hours_note | text | null | 영업시간 안내 |
| kakao_notice_url | text | null | 오픈카톡/공지 링크 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

### 4-2. `store_contacts`

고객 안내용 연락 채널.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 연락처 ID |
| store_id | uuid | FK | 매장 ID |
| contact_type | varchar(30) | not null | phone, kakao, zeropay 등 |
| contact_value | varchar(255) | not null | 실제 값 |
| note | varchar(255) | null | 설명 |
| is_active | boolean | not null default true | 사용 여부 |

### 4-3. `price_board_batches`

하루 단위 시세표 묶음.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 시세 배치 ID |
| store_id | uuid | FK | 매장 ID |
| board_date | date | not null | 기준 일자 |
| title | varchar(150) | null | 예: 2026-03-29 시세 |
| status | varchar(30) | not null | draft, published, archived |
| published_at | timestamptz | null | 공지 반영 시각 |
| created_by | uuid | null | 관리자 ID |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

유니크:

- `(store_id, board_date)`

### 4-4. `price_board_items`

시세표 개별 품목.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 품목 ID |
| batch_id | uuid | FK | 시세 배치 ID |
| item_name | varchar(120) | not null | 품목명 |
| origin_label | varchar(120) | null | 원산지 표기 |
| size_band | varchar(120) | null | 예: 2~2.5kg |
| unit_price | numeric(12,2) | null | kg 단가 |
| unit_label | varchar(40) | not null default 'kg' | 단위 |
| sale_status | varchar(30) | not null | available, reserved_only, sold_out |
| reservable_flag | boolean | not null default false | 예약 가능 여부 |
| reservation_cutoff_note | varchar(255) | null | 예: 오전 10시 전 |
| note | text | null | 추가 설명 |
| sort_order | integer | not null default 100 | 노출 순서 |
| created_at | timestamptz | not null | 생성 시각 |

인덱스:

- `(batch_id, sale_status)`
- `(batch_id, item_name)`

### 4-5. `processing_rules`

손질 옵션, 비용, 수령 방식 경고 규칙.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 규칙 ID |
| store_id | uuid | FK | 매장 ID |
| species_name | varchar(120) | not null | 품목명 또는 그룹명 |
| cut_type | varchar(50) | not null | raw, fillet, sashimi, sekkoshi 등 |
| fee_mode | varchar(30) | not null | per_kg, flat, custom |
| fee_amount | numeric(12,2) | null | 기본 비용 |
| fulfillment_warning | text | null | 예: 일반택배 회 비권장 |
| is_active | boolean | not null default true | 사용 여부 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

### 4-6. `orders`

주문 최상위 엔터티.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 주문 ID |
| store_id | uuid | FK | 매장 ID |
| order_no | varchar(40) | unique, not null | 주문번호 |
| public_token | varchar(80) | unique, not null | 고객 조회용 토큰 |
| order_status | varchar(40) | not null | 상태 사전 참고 |
| pricing_status | varchar(40) | not null | quote_pending 등 |
| payment_status | varchar(40) | not null | unpaid 등 |
| fulfillment_type | varchar(40) | not null | pickup, quick, parcel |
| fulfillment_subtype | varchar(40) | null | parcel_standard 등 |
| fulfillment_status | varchar(40) | not null | pickup_waiting 등 |
| purchase_unit | varchar(30) | not null | whole, half_request |
| match_status | varchar(40) | not null | match_not_needed 등 |
| requested_date | date | null | 희망 수령 날짜 |
| requested_time_slot | varchar(60) | null | 희망 수령 시간대 |
| requested_at_note | varchar(120) | null | 자유 텍스트 시간 메모 |
| is_reservation | boolean | not null default false | 예약 주문 여부 |
| reservation_target_date | date | null | 예약 대상 날짜 |
| item_hold_request_note | text | null | 경매 확보 요청 메모 |
| customer_name | varchar(80) | not null | 주문자명 |
| customer_phone | varchar(30) | not null | 주문자 연락처 |
| depositor_name | varchar(80) | null | 입금자명 |
| receiver_name | varchar(80) | null | 수령인명 |
| receiver_phone | varchar(30) | null | 수령인 연락처 |
| postal_code | varchar(20) | null | 우편번호 |
| address_line1 | varchar(200) | null | 주소 |
| address_line2 | varchar(200) | null | 상세 주소 |
| entrance_password | varchar(50) | null | 공동현관 비밀번호 |
| customer_request | text | null | 고객 요청사항 |
| internal_note | text | null | 내부 메모 |
| source_channel | varchar(40) | not null default 'kakao_openchat' | 유입 채널 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

인덱스:

- `(store_id, order_status, requested_date)`
- `(store_id, payment_status)`
- `(store_id, fulfillment_status)`
- `(store_id, match_status)`
- `(customer_phone)`

### 4-7. `order_items`

주문 품목 상세.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 주문 품목 ID |
| order_id | uuid | FK | 주문 ID |
| item_name | varchar(120) | not null | 품목명 |
| origin_label | varchar(120) | null | 원산지 |
| size_band | varchar(120) | null | 규격 |
| quantity | numeric(12,3) | not null | 수량 또는 kg |
| unit_label | varchar(30) | not null default 'kg' | 단위 |
| requested_cut_type | varchar(50) | null | 원물/오로시/회 등 |
| packing_option | varchar(80) | null | 진공포장 등 |
| unit_price | numeric(12,2) | null | 단가 |
| estimated_total | numeric(12,2) | null | 품목 예상 합계 |
| created_at | timestamptz | not null | 생성 시각 |

### 4-8. `order_quotes`

최종 금액 확정 내역.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 견적 ID |
| order_id | uuid | FK unique | 주문 ID |
| item_subtotal | numeric(12,2) | not null | 원물/상품 합계 |
| processing_fee_total | numeric(12,2) | not null default 0 | 손질비 |
| delivery_fee_total | numeric(12,2) | not null default 0 | 운임비 |
| discount_total | numeric(12,2) | not null default 0 | 할인 |
| final_amount | numeric(12,2) | not null | 최종 금액 |
| receipt_type_note | varchar(120) | null | 현금영수증 등 메모 |
| payment_method_note | varchar(120) | null | 계좌/제로페이/온누리 등 |
| quote_note | text | null | 정산 메모 |
| quoted_by | uuid | null | 확정 담당자 |
| quoted_at | timestamptz | not null | 확정 시각 |
| revised_count | integer | not null default 0 | 수정 횟수 |

### 4-9. `payments`

주문별 결제 상태 요약.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 결제 ID |
| order_id | uuid | FK unique | 주문 ID |
| expected_amount | numeric(12,2) | not null | 기대 입금 금액 |
| paid_amount | numeric(12,2) | not null default 0 | 실제 연결 금액 |
| payment_status | varchar(40) | not null | unpaid 등 |
| confirmed_by_mode | varchar(20) | null | manual, auto |
| confirmed_by_user_id | uuid | null | 수동 확인자 |
| confirmed_at | timestamptz | null | 확인 시각 |
| note | text | null | 입금 관련 메모 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

### 4-10. `payment_events`

입금 상태 변경 이력.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 이벤트 ID |
| payment_id | uuid | FK | 결제 ID |
| from_status | varchar(40) | null | 이전 상태 |
| to_status | varchar(40) | not null | 변경 상태 |
| reason | varchar(120) | null | 변경 사유 |
| created_by | uuid | null | 변경 사용자 |
| created_at | timestamptz | not null | 생성 시각 |

### 4-11. `bank_transactions`

실제 계좌 거래 원장.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 거래 ID |
| store_id | uuid | FK | 매장 ID |
| provider_name | varchar(80) | null | 은행/핀테크 |
| external_txn_id | varchar(120) | null | 외부 거래 ID |
| transaction_at | timestamptz | not null | 거래 시각 |
| depositor_name | varchar(80) | null | 입금자명 |
| amount | numeric(12,2) | not null | 입금 금액 |
| currency | varchar(10) | not null default 'KRW' | 통화 |
| raw_payload | jsonb | null | 원본 데이터 |
| imported_at | timestamptz | not null | 불러온 시각 |

인덱스:

- `(store_id, transaction_at desc)`
- `(store_id, amount, depositor_name)`

### 4-12. `payment_matches`

거래와 주문의 연결 기록.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 매칭 ID |
| payment_id | uuid | FK | 결제 ID |
| bank_transaction_id | uuid | FK | 거래 ID |
| match_status | varchar(40) | not null | linked, review_required, rejected |
| match_score | numeric(5,2) | null | 추천 점수 |
| matched_by_mode | varchar(20) | not null | manual, auto |
| matched_by_user_id | uuid | null | 수동 처리자 |
| note | text | null | 메모 |
| created_at | timestamptz | not null | 생성 시각 |

### 4-13. `fulfillments`

수령/출고 전용 정보.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 출고 ID |
| order_id | uuid | FK unique | 주문 ID |
| fulfillment_type | varchar(40) | not null | pickup, quick, parcel |
| fulfillment_subtype | varchar(40) | null | parcel_standard 등 |
| fulfillment_status | varchar(40) | not null | pickup_waiting 등 |
| quick_request_time | timestamptz | null | 퀵 요청 시간 |
| quick_dispatch_note | text | null | 퀵 전달 메모 |
| parcel_tracking_no | varchar(120) | null | 송장번호 |
| packing_note | text | null | 아이스/진공 포장 메모 |
| handed_off_at | timestamptz | null | 인계/발송 시각 |
| handed_off_by | uuid | null | 인계 처리자 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

### 4-14. `match_groups`

반절 주문 매칭 그룹.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 매칭 그룹 ID |
| store_id | uuid | FK | 매장 ID |
| item_name | varchar(120) | not null | 품목명 |
| size_band | varchar(120) | null | 규격 |
| target_date | date | null | 수령 날짜 |
| target_time_slot | varchar(60) | null | 수령 시간대 |
| fulfillment_type | varchar(40) | null | 픽업/퀵/택배 기준 |
| match_status | varchar(40) | not null | matching_review, matched 등 |
| matching_deadline_at | timestamptz | null | 매칭 대기 마감 |
| created_by | uuid | null | 생성자 |
| created_at | timestamptz | not null | 생성 시각 |
| updated_at | timestamptz | not null | 수정 시각 |

### 4-15. `match_group_members`

매칭 그룹 참여 주문.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 멤버 ID |
| match_group_id | uuid | FK | 매칭 그룹 ID |
| order_id | uuid | FK | 주문 ID |
| role | varchar(20) | not null | a, b |
| created_at | timestamptz | not null | 생성 시각 |

유니크:

- `(match_group_id, order_id)`

### 4-16. `order_status_logs`

주문 상태 변경 로그.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 로그 ID |
| order_id | uuid | FK | 주문 ID |
| status_group | varchar(30) | not null | order, payment, fulfillment, match, pricing |
| from_status | varchar(40) | null | 이전 상태 |
| to_status | varchar(40) | not null | 변경 상태 |
| reason | varchar(255) | null | 사유 |
| created_by | uuid | null | 변경 사용자 |
| created_at | timestamptz | not null | 생성 시각 |

### 4-17. `audit_logs`

운영 감사 로그.

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | 감사 로그 ID |
| store_id | uuid | FK | 매장 ID |
| actor_user_id | uuid | null | 행위자 |
| target_type | varchar(40) | not null | order, quote, payment 등 |
| target_id | uuid | not null | 대상 ID |
| action_type | varchar(60) | not null | create, update, confirm 등 |
| payload | jsonb | null | 변경 상세 |
| created_at | timestamptz | not null | 생성 시각 |

## 5. 핵심 관계 요약

- `stores 1:N price_board_batches`
- `price_board_batches 1:N price_board_items`
- `stores 1:N processing_rules`
- `stores 1:N orders`
- `orders 1:N order_items`
- `orders 1:1 order_quotes`
- `orders 1:1 payments`
- `orders 1:1 fulfillments`
- `payments 1:N payment_events`
- `payments 1:N payment_matches`
- `bank_transactions 1:N payment_matches`
- `match_groups 1:N match_group_members`
- `orders 1:N order_status_logs`

## 6. 필수 체크 제약

- `orders.order_status = 'completed'` 전환 전 `payments.payment_status`가 `manual_confirmed` 또는 `auto_confirmed`인지 검증
- `orders.fulfillment_type = 'parcel'`인데 주소가 비어 있으면 저장 불가
- `orders.purchase_unit = 'half_request'`이면 `match_status != 'match_not_needed'`
- `order_quotes.final_amount >= 0`
- `payments.expected_amount = order_quotes.final_amount`를 서비스 레이어에서 유지

## 7. 권장 인덱스

- 주문 조회:
  - `(store_id, requested_date, order_status)`
  - `(store_id, pricing_status, payment_status)`
  - `(store_id, fulfillment_type, fulfillment_status)`
- 검색:
  - `(customer_name)`
  - `(customer_phone)`
  - `(order_no)`
- 입금 대조:
  - `(store_id, amount, depositor_name, transaction_at)`
- 반절 매칭:
  - `(store_id, match_status, requested_date, fulfillment_type)`

## 8. MVP 우선 구현 테이블

- `stores`
- `price_board_batches`
- `price_board_items`
- `processing_rules`
- `orders`
- `order_items`
- `order_quotes`
- `payments`
- `fulfillments`
- `order_status_logs`
- `audit_logs`

## 9. MVP 이후 확장 테이블

- `bank_transactions`
- `payment_matches`
- `match_groups`
- `match_group_members`
- `payment_events`

## 10. 마이그레이션 우선순위 제안

### 1차

- 매장, 시세표, 주문, 주문 품목

### 2차

- 정산, 결제, 출고

### 3차

- 반절 매칭

### 4차

- 은행 거래 연동과 자동 입금 대조
