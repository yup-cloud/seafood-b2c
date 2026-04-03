# API 명세

## 1. 문서 목적

이 문서는 고객용 주문 흐름과 관리자 운영 흐름을 구현하기 위한 HTTP API 초안을 정의한다.  
스타일은 REST JSON API를 기준으로 한다.

## 2. 공통 규칙

- Base URL: `/api/v1`
- 응답 형식: `application/json`
- 인증:
  - 고객용 공개 API: 인증 없음, 공개 토큰 사용 가능
  - 관리자 API: 세션 또는 Bearer 토큰
- 시간대: `Asia/Seoul`
- 금액 단위: KRW

## 3. 공통 응답 형식

### 성공

```json
{
  "data": {},
  "meta": {
    "request_id": "req_123"
  }
}
```

### 실패

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 항목이 누락되었습니다.",
    "fields": {
      "receiver_name": "택배 주문에는 수령인명이 필요합니다."
    }
  }
}
```

## 4. 공개 고객 API

### 4-1. 매장 기본 정보 조회

`GET /public/store`

용도:

- 고객 주문 페이지 상단 정보
- 주소, 연락처, 영업시간, 계좌 정보 안내

응답 주요 필드:

- `name`
- `phones`
- `address`
- `business_hours_note`
- `bank_name`
- `bank_account`
- `bank_holder`

### 4-2. 오늘 시세/주문 가이드 조회

`GET /public/price-board/today`

쿼리:

- `date` optional

응답 주요 필드:

- `board_date`
- `items[]`
  - `item_name`
  - `origin_label`
  - `size_band`
  - `unit_price`
  - `sale_status`
  - `reservable_flag`
  - `reservation_cutoff_note`
- `order_guide`
  - `pickup_note`
  - `quick_note`
  - `parcel_note`
  - `processing_rules_summary`

### 4-3. 주문서 초기 데이터 조회

`GET /public/order-form/options`

응답 주요 필드:

- `purchase_units`
- `fulfillment_types`
- `parcel_subtypes`
- `cut_types`
- `processing_fee_rules`
- `warnings`

### 4-4. 주문 생성

`POST /public/orders`

요청 예시:

```json
{
  "customer_name": "홍길동",
  "customer_phone": "010-1234-5678",
  "depositor_name": "홍길동",
  "purchase_unit": "whole",
  "requested_date": "2026-04-03",
  "requested_time_slot": "15:00-16:00",
  "fulfillment_type": "parcel",
  "fulfillment_subtype": "parcel_standard",
  "receiver_name": "홍길동",
  "receiver_phone": "010-1234-5678",
  "postal_code": "06900",
  "address_line1": "서울특별시 동작구 ...",
  "address_line2": "101동 101호",
  "customer_request": "진공포장 부탁드립니다.",
  "items": [
    {
      "item_name": "보리숭어",
      "size_band": "1~1.3kg",
      "quantity": 1,
      "unit_label": "fish",
      "requested_cut_type": "fillet",
      "packing_option": "vacuum"
    }
  ]
}
```

검증 규칙:

- 퀵/택배는 수령인 정보 필수
- 일반택배 + 회 조합은 경고 또는 서버 차단 정책 가능
- 반절 주문은 `purchase_unit = half_request`

응답 주요 필드:

- `order_id`
- `order_no`
- `public_token`
- `order_status`
- `pricing_status`
- `payment_status`

### 4-5. 주문 완료/상태 조회

`GET /public/orders/{public_token}`

용도:

- 고객 주문 완료 화면
- 최종 금액 확정 여부
- 입금 안내
- 출고 상태 안내

응답 주요 필드:

- `order_no`
- `order_status`
- `pricing_status`
- `payment_status`
- `fulfillment_status`
- `quoted_amount`
- `bank_guide`
- `next_step_message`

## 5. 관리자 주문 운영 API

### 5-1. 주문 목록 조회

`GET /admin/orders`

쿼리:

- `date`
- `order_status`
- `pricing_status`
- `payment_status`
- `fulfillment_status`
- `match_status`
- `search`
- `is_reservation`

응답 주요 필드:

- `orders[]`
  - `id`
  - `order_no`
  - `customer_name`
  - `item_summary`
  - `requested_time_slot`
  - `pricing_status`
  - `payment_status`
  - `fulfillment_status`
  - `match_status`

### 5-2. 주문 상세 조회

`GET /admin/orders/{order_id}`

응답 주요 필드:

- 주문 기본 정보
- 품목 목록
- 최종 금액 정보
- 결제 정보
- 출고 정보
- 매칭 정보
- 상태 로그

### 5-3. 주문 기본 정보 수정

`PATCH /admin/orders/{order_id}`

수정 가능 예:

- `requested_date`
- `requested_time_slot`
- `receiver_name`
- `receiver_phone`
- `address_line1`
- `address_line2`
- `customer_request`
- `internal_note`

### 5-4. 주문 상태 변경

`POST /admin/orders/{order_id}/status`

요청:

```json
{
  "status_group": "order",
  "to_status": "ready_for_prep",
  "reason": "입금 확인 완료"
}
```

검증:

- `completed` 전환 시 미입금이면 경고 또는 차단

### 5-5. 최종 금액 확정

`POST /admin/orders/{order_id}/quote`

요청 예시:

```json
{
  "item_subtotal": 54000,
  "processing_fee_total": 4000,
  "delivery_fee_total": 7000,
  "discount_total": 0,
  "final_amount": 65000,
  "receipt_type_note": "현금영수증 요청",
  "payment_method_note": "계좌이체",
  "quote_note": "당일택배 포함"
}
```

동작:

- `pricing_status`를 `quoted`로 전환
- `payment_status`를 `unpaid` 유지
- 주문 상태를 `waiting_payment`로 전환 가능

### 5-6. 입금 수동 확인

`POST /admin/orders/{order_id}/payments/manual-confirm`

요청:

```json
{
  "confirmed_amount": 65000,
  "note": "입금자명 일치 확인"
}
```

동작:

- `payment_status = manual_confirmed`
- 주문 상태를 `ready_for_prep`로 이동 가능

### 5-7. 입금 검토 필요 처리

`POST /admin/orders/{order_id}/payments/review`

요청:

```json
{
  "reason": "동일 금액 주문 2건",
  "note": "입금자명 불일치"
}
```

## 6. 시세/주문 가이드 관리 API

### 6-1. 오늘 시세표 조회

`GET /admin/price-board`

쿼리:

- `date`

### 6-2. 시세표 생성 또는 갱신

`POST /admin/price-board`

요청:

```json
{
  "board_date": "2026-04-03",
  "title": "2026-04-03 오늘바다 데모 시세"
}
```

### 6-3. 시세 품목 추가

`POST /admin/price-board/items`

요청 주요 필드:

- `batch_id`
- `item_name`
- `origin_label`
- `size_band`
- `unit_price`
- `sale_status`
- `reservable_flag`
- `reservation_cutoff_note`

### 6-4. 시세 품목 수정

`PATCH /admin/price-board/items/{item_id}`

수정 가능 예:

- 가격
- 품절 상태
- 예약 가능 여부
- 메모

### 6-5. 시세표 발행

`POST /admin/price-board/{batch_id}/publish`

동작:

- `status = published`
- 공개 주문 가이드에 반영

## 7. 손질 규칙/가공 정책 API

### 7-1. 손질 규칙 목록 조회

`GET /admin/processing-rules`

### 7-2. 손질 규칙 생성

`POST /admin/processing-rules`

요청 주요 필드:

- `species_name`
- `cut_type`
- `fee_mode`
- `fee_amount`
- `fulfillment_warning`

### 7-3. 손질 규칙 수정

`PATCH /admin/processing-rules/{rule_id}`

## 8. 출고/수령 API

### 8-1. 출고 대기 목록 조회

`GET /admin/fulfillments`

쿼리:

- `fulfillment_type`
- `fulfillment_status`
- `date`

### 8-2. 출고 정보 수정

`PATCH /admin/orders/{order_id}/fulfillment`

요청 예시:

```json
{
  "fulfillment_subtype": "parcel_same_day",
  "quick_dispatch_note": "고객이 카카오퀵 호출",
  "parcel_tracking_no": "1234-5678-9999"
}
```

### 8-3. 직접 픽업 완료 처리

`POST /admin/orders/{order_id}/fulfillment/pickup-done`

### 8-4. 퀵 인계 완료 처리

`POST /admin/orders/{order_id}/fulfillment/quick-sent`

### 8-5. 택배 발송 완료 처리

`POST /admin/orders/{order_id}/fulfillment/parcel-sent`

## 9. 예약 주문 API

### 9-1. 예약 주문 목록 조회

`GET /admin/reservations`

쿼리:

- `target_date`
- `sale_status`

### 9-2. 예약 주문 메모 수정

`PATCH /admin/orders/{order_id}/reservation`

요청 예시:

```json
{
  "reservation_target_date": "2026-04-04",
  "item_hold_request_note": "경매 때 연어 큰 개체 확보 요청"
}
```

## 10. 반절 매칭 API

### 10-1. 매칭 대기 주문 조회

`GET /admin/matching/orders`

쿼리:

- `item_name`
- `date`
- `fulfillment_type`

### 10-2. 매칭 후보 추천 조회

`GET /admin/matching/orders/{order_id}/candidates`

응답 주요 필드:

- `candidate_order_id`
- `match_score`
- `reasons`
- `warnings`

### 10-3. 매칭 그룹 생성

`POST /admin/matching/groups`

요청 예시:

```json
{
  "order_ids": [
    "ord_1",
    "ord_2"
  ],
  "note": "같은 3kg 광어 반절 매칭"
}
```

### 10-4. 매칭 실패 처리

`POST /admin/matching/orders/{order_id}/fail`

요청:

```json
{
  "reason": "마감 시간 초과",
  "next_action": "offer_whole"
}
```

## 11. 자동 입금확인/거래 API

### 11-1. 거래 내역 업로드 또는 수집

`POST /admin/bank-transactions/import`

동작:

- CSV 업로드 또는 외부 수집 결과 반영

### 11-2. 거래 목록 조회

`GET /admin/bank-transactions`

쿼리:

- `date_from`
- `date_to`
- `amount`
- `matched`

### 11-3. 입금 검토 큐 조회

`GET /admin/payment-review`

응답 주요 필드:

- `order_id`
- `expected_amount`
- `transaction_candidates`
- `review_reason`

### 11-4. 거래 수동 연결

`POST /admin/payment-review/{order_id}/link`

요청 예시:

```json
{
  "bank_transaction_id": "txn_123",
  "note": "연락처로 최종 확인"
}
```

### 11-5. 자동 대조 실행

`POST /admin/payment-review/run-auto-match`

동작:

- 미매칭 거래와 미입금 주문 대조
- 명확한 후보는 `auto_confirmed`
- 애매한 후보는 `review_required`

## 12. 감사 로그 API

### 12-1. 주문 로그 조회

`GET /admin/orders/{order_id}/logs`

### 12-2. 감사 로그 조회

`GET /admin/audit-logs`

쿼리:

- `target_type`
- `target_id`
- `date_from`
- `date_to`

## 13. 권장 에러 코드

- `VALIDATION_ERROR`
- `ORDER_NOT_FOUND`
- `PRICE_BOARD_NOT_FOUND`
- `QUOTE_REQUIRED`
- `PAYMENT_NOT_CONFIRMED`
- `FULFILLMENT_BLOCKED`
- `MATCH_CONFLICT`
- `RESERVATION_CUTOFF_PASSED`
- `UNSUPPORTED_FULFILLMENT_COMBINATION`

## 14. MVP 우선 구현 API

- `/public/store`
- `/public/price-board/today`
- `/public/order-form/options`
- `/public/orders`
- `/public/orders/{public_token}`
- `/admin/orders`
- `/admin/orders/{order_id}`
- `/admin/orders/{order_id}/quote`
- `/admin/orders/{order_id}/status`
- `/admin/orders/{order_id}/payments/manual-confirm`
- `/admin/orders/{order_id}/fulfillment`
- `/admin/price-board`
- `/admin/price-board/items`

## 15. MVP 이후 우선 API

- `/admin/reservations`
- `/admin/matching/orders`
- `/admin/matching/groups`
- `/admin/payment-review`
- `/admin/bank-transactions/import`
