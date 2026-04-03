# 상태 사전

## 1. 문서 목적

이 문서는 주문, 정산, 입금, 수령/출고, 반절 매칭 상태를 한 번에 정의하는 기준 문서다.  
화면, API, DB에서 서로 다른 상태명을 쓰지 않도록 공통 기준으로 사용한다.

## 2. 상태 설계 원칙

- 주문 상태와 입금 상태는 분리한다
- 주문 상태와 수령/출고 상태도 분리한다
- 반절 매칭은 별도 상태로 관리한다
- 사람이 개입해야 하는 예외는 `review` 성격 상태로 표현한다
- 출고 이후 감사 로그로 복구 가능해야 한다

## 3. 주문 상태

### `new`

- 의미: 고객이 주문서를 제출했고 아직 관리자 검토가 시작되지 않음
- 다음 가능 상태:
  - `pricing_pending`
  - `waiting_payment`
  - `cancelled`

### `pricing_pending`

- 의미: 최종 금액이 아직 확정되지 않음
- 사용 상황:
  - 원물 가격 확정 필요
  - 손질비/운임비 계산 필요
  - 반절 매칭 완료 후 금액 산정 필요
- 다음 가능 상태:
  - `waiting_payment`
  - `cancelled`

### `waiting_payment`

- 의미: 최종 금액은 확정됐고 입금을 기다리는 상태
- 다음 가능 상태:
  - `payment_review`
  - `ready_for_prep`
  - `cancelled`

### `payment_review`

- 의미: 입금은 들어왔지만 자동/수동 검토가 필요한 상태
- 사용 상황:
  - 입금자명 불일치
  - 동일 금액 후보 다수
  - 부분 입금/초과 입금
- 다음 가능 상태:
  - `ready_for_prep`
  - `waiting_payment`
  - `cancelled`

### `ready_for_prep`

- 의미: 결제 확인이 끝나 손질 대기 중인 상태
- 다음 가능 상태:
  - `in_prep`
  - `cancelled`

### `in_prep`

- 의미: 손질 또는 포장 작업이 진행 중인 상태
- 다음 가능 상태:
  - `packed`
  - `cancelled`

### `packed`

- 의미: 손질과 포장이 완료된 상태
- 다음 가능 상태:
  - `ready_for_handoff`
  - `completed`

### `ready_for_handoff`

- 의미: 직접 픽업, 퀵, 택배 방식에 따라 인계 또는 발송을 기다리는 상태
- 다음 가능 상태:
  - `completed`
  - `cancelled`

### `completed`

- 의미: 직접 픽업 완료, 퀵 기사 인계 완료, 택배 발송 완료 중 하나가 끝난 상태

### `cancelled`

- 의미: 주문이 취소된 상태

## 4. 정산 상태

### `quote_not_needed`

- 의미: 주문 즉시 금액 확정 가능한 단순 주문

### `quote_pending`

- 의미: 최종 금액 산정 필요

### `quoted`

- 의미: 최종 금액 확정 완료

### `requoted`

- 의미: 초기 확정 금액이 수정됨

## 5. 입금 상태

### `unpaid`

- 의미: 미입금

### `review_required`

- 의미: 입금 확인 검토 필요

### `manual_confirmed`

- 의미: 관리자가 수동 확인 완료

### `auto_confirmed`

- 의미: 시스템이 자동 매칭 기준에 따라 확인 완료

### `partial_paid`

- 의미: 일부만 입금됨

### `over_paid`

- 의미: 초과 입금됨

### `refund_required`

- 의미: 환불 후속 조치 필요

## 6. 수령/출고 상태

### `pickup_waiting`

- 의미: 직접 픽업 대기

### `pickup_done`

- 의미: 직접 픽업 완료

### `quick_waiting`

- 의미: 퀵 접수 또는 기사 인계 대기

### `quick_sent`

- 의미: 퀵 기사 인계 완료

### `parcel_waiting`

- 의미: 택배 발송 대기

### `parcel_sent`

- 의미: 택배 발송 완료

## 7. 수령 방식

### `pickup`

- 직접 픽업

### `quick`

- 퀵

### `parcel`

- 택배

## 8. 택배 세부 유형

### `parcel_standard`

- 일반택배

### `parcel_same_day`

- 당일택배

### `parcel_bus`

- 고속택배 또는 고속 연계

## 9. 반절 매칭 상태

### `match_not_needed`

- 일반 주문으로 매칭 대상 아님

### `matching_waiting`

- 반절 주문으로 매칭 대기 중

### `matching_review`

- 후보 검토 중

### `matched`

- 매칭 완료

### `match_failed`

- 매칭 실패

## 10. 품목 판매 상태

### `available`

- 오늘 주문 가능

### `reserved_only`

- 예약 주문만 가능

### `sold_out`

- 품절 또는 완판

## 11. 추천 상태 전이 요약

### 일반 주문

`new` -> `pricing_pending` -> `waiting_payment` -> `ready_for_prep` -> `in_prep` -> `packed` -> `ready_for_handoff` -> `completed`

### 단순 즉시 금액 주문

`new` -> `waiting_payment` -> `ready_for_prep` -> `in_prep` -> `packed` -> `ready_for_handoff` -> `completed`

### 반절 주문

`new` -> `pricing_pending` + `matching_waiting` -> `matched` -> `waiting_payment` -> `ready_for_prep` -> `in_prep` -> `packed` -> `ready_for_handoff` -> `completed`

## 12. 운영 규칙 메모

- `pricing_pending` 상태에서는 자동 입금확인 금지
- `unpaid` 상태에서 `completed` 전환 시 경고 또는 예외 승인 필요
- `pickup_done`, `quick_sent`, `parcel_sent` 중 하나가 끝나면 주문은 `completed`로 전환 가능
- `match_failed` 상태는 자동 취소가 아니라 관리자 판단 상태로 남기는 것이 안전함
