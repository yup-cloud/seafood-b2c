import {
  AdminOrderDetail,
  AdminOrdersResponse,
  FulfillmentQueueItem,
  HalfOrderDemandItem,
  OrderFormOptions,
  PaymentReviewItem,
  PriceBoardResponse,
  PublicOrderResult,
  PublicOrderStatus,
  StoreInfo
} from "../types";

export const demoStore: StoreInfo = {
  name: "참조은수산",
  phones: ["010-3786-7555", "010-7584-0094"],
  bank_guide: {
    bank_name: "신한은행",
    bank_account: "110-165-872666",
    bank_holder: "김태이"
  },
  address: {
    line1: "노량진수산시장 남5문 선어 80,81호",
    line2: "방문 포장비 없음 · 진공포장 무료"
  },
  business_hours_note: "월~금 05:00~18:00 / 토 05:00~19:00 / 일 07:00~17:00"
};

export const demoPriceBoard: PriceBoardResponse = {
  board_date: "2026-04-06",
  items: [
    {
      id: "pb_1",
      item_name: "자연산 광어",
      origin_label: "국산",
      size_band: "3~5kg",
      unit_price: "22000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "반반 주문 가능 / 상태 최상급",
      note: "SSSS · 정품 최상급 낚시바리"
    },
    {
      id: "pb_2",
      item_name: "자연산 도다리",
      origin_label: "국산",
      size_band: "1~1.5kg",
      unit_price: "20000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "전화·문자 문의 우선",
      note: "S · 상태 좋음"
    },
    {
      id: "pb_3",
      item_name: "자연산 감성돔 (목포)",
      origin_label: "국산",
      size_band: "1.3~1.5kg",
      unit_price: "20000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "전화·문자 문의 우선",
      note: "SS · 상태 최강"
    },
    {
      id: "pb_4",
      item_name: "광어 (제주 · 2.8~3.2kg)",
      origin_label: "국산",
      size_band: "2.8~3.2kg",
      unit_price: "30000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SS · 정품 상태 최강"
    },
    {
      id: "pb_5",
      item_name: "광어 (제주 · 2~2.5kg)",
      origin_label: "국산",
      size_band: "2~2.5kg",
      unit_price: "28000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "S · 정품 상태 최강"
    },
    {
      id: "pb_6",
      item_name: "완도전복",
      origin_label: "국산",
      size_band: "10~11미",
      unit_price: "24000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SS · 정품 상태 최강"
    },
    {
      id: "pb_7",
      item_name: "돌돔 (일본산 · 2kg급)",
      origin_label: "일본산",
      size_band: "2kg",
      unit_price: "90000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "고가 어종 / 예약 문의 권장",
      note: "SSSSS · 기스 없는 최상급"
    },
    {
      id: "pb_8",
      item_name: "돌돔 (일본산 · 1.6~1.8kg)",
      origin_label: "일본산",
      size_band: "1.6~1.8kg",
      unit_price: "85000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "고가 어종 / 예약 문의 권장",
      note: "SSSS · 기스 없는 최상급"
    },
    {
      id: "pb_9",
      item_name: "능성어 (일본산)",
      origin_label: "일본산",
      size_band: "3.5~4kg",
      unit_price: "40000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SS · 정품 상태 최강"
    },
    {
      id: "pb_10",
      item_name: "잿방어 (일본산)",
      origin_label: "일본산",
      size_band: "4.5kg",
      unit_price: "30000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SS · 정품 상태 최강"
    },
    {
      id: "pb_11",
      item_name: "참돔 (일본산 · 2.5~3kg)",
      origin_label: "일본산",
      size_band: "2.5~3kg",
      unit_price: "25000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SSS · 정품 상태 최강"
    },
    {
      id: "pb_12",
      item_name: "참돔 (일본산 · 2kg 이하)",
      origin_label: "일본산",
      size_band: "2kg",
      unit_price: "20000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "S · 정품 상태 최강"
    },
    {
      id: "pb_13",
      item_name: "감성돔 (중국산)",
      origin_label: "중국산",
      size_band: "1kg",
      unit_price: "23000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "SS · 정품 상태 최강"
    },
    {
      id: "pb_14",
      item_name: "농어 (중국산)",
      origin_label: "중국산",
      size_band: "3~3.5kg",
      unit_price: "23000",
      unit_label: "kg",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "당일 문의 가능",
      note: "S · 정품 상태 최강"
    },
    {
      id: "pb_15",
      item_name: "연어 (노르웨이 · 예약판매)",
      origin_label: "노르웨이",
      size_band: "6~8kg",
      unit_price: "23000",
      unit_label: "kg",
      sale_status: "reserved_only",
      reservable_flag: true,
      reservation_cutoff_note: "전날 주문 / 반마리는 전날 매칭 시 진행",
      note: "최상급 · 마리 단위 예약 판매"
    }
  ],
  order_guide: {
    pickup_note: "방문 손님 포장비는 없고, 진공포장은 무료예요. 방문 시간만 미리 알려주세요.",
    quick_note: "노량진 기준 15km 이내는 카카오퀵 이코노미가 당일택배와 금액 차이가 크지 않을 수 있어요.",
    parcel_note: "당일택배는 오전 9시 30분 전 문자 주문이 필요하고, 원물은 진공포장이 불가해요.",
    processing_rules_summary: [
      "오로시(필렛) kg당 2,000원",
      "회 작업 kg당 4,000원",
      "도미 등 껍질 작업 kg당 5,000원",
      "진공포장은 무료이며 원물은 진공 불가"
    ],
    cutoff_windows: [
      {
        fulfillment_type: "pickup",
        label: "매장 픽업",
        cutoff_note: "방문 예정 시간만 먼저 남겨주시면 순서에 맞춰 준비해드려요."
      },
      {
        fulfillment_type: "quick",
        label: "퀵 수령",
        cutoff_note: "당일 드실 분은 퀵이 가장 안정적이고, 최소 2~3시간 전 주문이 좋아요."
      },
      {
        fulfillment_type: "parcel",
        label: "택배 수령",
        cutoff_note: "당일택배는 오전 9시 30분 전 문자 주문, 일반택배는 필렛·오로시 위주로 권장해요."
      }
    ],
    expected_price_note:
      "시세표의 가격은 kg당 기준이라, 선택하신 중량대에 맞춰 예상 원물가를 먼저 보여드리고 최종 금액을 다시 안내해드려요.",
    reservation_deposit_policy:
      "연어와 일부 고가 어종은 전날 예약이 필요하고, 예약 진행 시 먼저 가능 여부와 예약금 여부를 안내해드려요."
  }
};

export const demoOrderOptions: OrderFormOptions = {
  purchase_units: ["whole", "half_request"],
  fulfillment_types: ["pickup", "quick", "parcel"],
  parcel_subtypes: ["parcel_standard", "parcel_same_day", "parcel_bus"],
  cut_types: ["raw", "fillet", "sashimi", "masukawa", "sekkoshi"],
  processing_fee_rules: [
    {
      id: "rule_1",
      species_name: "광어",
      cut_type: "fillet",
      fee_mode: "kg당",
      fee_amount: "2000",
      fulfillment_warning: "일반택배는 오로시 권장",
      is_active: true
    },
    {
      id: "rule_2",
      species_name: "광어",
      cut_type: "sashimi",
      fee_mode: "kg당",
      fee_amount: "4000",
      fulfillment_warning: "회는 퀵 또는 픽업 권장",
      is_active: true
    }
  ],
  store_id: "store_demo",
  warnings: [
    "일반택배는 회보다 오로시/필렛 수령을 권장합니다.",
    "반절 주문은 매칭 완료 후 최종 금액이 확정될 수 있습니다."
  ]
};

export const demoOrderResult: PublicOrderResult = {
  order_id: "ord_demo_1",
  order_no: "OB-20260401-013",
  public_token: "demo-public-token",
  order_status: "pricing_pending",
  pricing_status: "quote_pending",
  payment_status: "unpaid"
};

export const demoOrderStatus: PublicOrderStatus = {
  public_token: "demo-public-token",
  order_no: "OB-20260401-013",
  order_status: "waiting_payment",
  pricing_status: "quoted",
  payment_status: "unpaid",
  fulfillment_status: "parcel_waiting",
  quoted_amount: "65000",
  bank_guide: demoStore.bank_guide,
  next_step_message: "최종 금액 65,000원 확인 후 안내된 계좌로 입금해주세요."
};

export const demoHalfOrderDemands: HalfOrderDemandItem[] = [
  {
    id: "half_1",
    item_name: "자연산 광어",
    origin_label: "국산",
    size_band: "3~5kg",
    unit_price: "22000",
    wanted_portion_label: "반마리",
    waiting_count: 2,
    fulfillment_hint: "픽업 · 퀵 선호",
    urgency_label: "오늘 매칭 쉬움",
    note: "당일 저녁용 문의가 가장 많아요."
  },
  {
    id: "half_2",
    item_name: "참돔 (일본산 · 2.5~3kg)",
    origin_label: "일본산",
    size_band: "2.5~3kg",
    unit_price: "25000",
    wanted_portion_label: "반마리",
    waiting_count: 1,
    fulfillment_hint: "픽업 선호",
    urgency_label: "1팀 더 필요",
    note: "껍질 작업 문의가 함께 들어와요."
  },
  {
    id: "half_3",
    item_name: "연어 (노르웨이 · 예약판매)",
    origin_label: "노르웨이",
    size_band: "6~8kg",
    unit_price: "23000",
    wanted_portion_label: "반마리",
    waiting_count: 1,
    fulfillment_hint: "전날 예약",
    urgency_label: "전날 매칭",
    note: "전날 주문 시 매칭이 가장 잘 돼요."
  }
];

export const demoAdminOrders: AdminOrdersResponse = {
  filters: {
    date: "2026-04-01",
    order_status: null,
    pricing_status: null,
    payment_status: null,
    fulfillment_status: null,
    match_status: null,
    search: null,
    is_reservation: null
  },
  orders: [
    {
      id: "ord_demo_1",
      order_no: "OB-20260401-013",
      customer_name: "홍길동",
      customer_phone: "010-1234-5678",
      item_summary: "광어",
      requested_date: "2026-04-03",
      requested_time_slot: "15:00-16:00",
      pricing_status: "quoted",
      payment_status: "unpaid",
      fulfillment_status: "parcel_waiting",
      match_status: "match_not_needed",
      order_status: "waiting_payment",
      fulfillment_type: "parcel",
      is_reservation: false,
      created_at: "2026-04-01T09:14:00+09:00"
    },
    {
      id: "ord_demo_2",
      order_no: "OB-20260401-014",
      customer_name: "김철수",
      customer_phone: "010-2211-8822",
      item_summary: "보리숭어",
      requested_date: "2026-04-01",
      requested_time_slot: "17:30-18:00",
      pricing_status: "quoted",
      payment_status: "manual_confirmed",
      fulfillment_status: "quick_waiting",
      match_status: "match_not_needed",
      order_status: "ready_for_prep",
      fulfillment_type: "quick",
      is_reservation: false,
      created_at: "2026-04-01T10:02:00+09:00"
    },
    {
      id: "ord_demo_3",
      order_no: "OB-20260401-015",
      customer_name: "박영희",
      customer_phone: "010-9988-1144",
      item_summary: "광어 반절 희망",
      requested_date: "2026-04-02",
      requested_time_slot: "15:00-15:30",
      pricing_status: "quote_pending",
      payment_status: "unpaid",
      fulfillment_status: "pickup_waiting",
      match_status: "matching_waiting",
      order_status: "pricing_pending",
      fulfillment_type: "pickup",
      is_reservation: true,
      created_at: "2026-04-01T10:34:00+09:00"
    }
  ]
};

export const demoAdminOrderDetail: AdminOrderDetail = {
  id: "ord_demo_1",
  order_no: "OB-20260401-013",
  order_status: "waiting_payment",
  pricing_status: "quoted",
  payment_status: "unpaid",
  fulfillment_status: "parcel_waiting",
  fulfillment_type: "parcel",
  fulfillment_subtype: "parcel_same_day",
  customer_name: "홍길동",
  customer_phone: "010-1234-5678",
  depositor_name: "홍길동",
  receiver_name: "홍길동",
  receiver_phone: "010-1234-5678",
  requested_date: "2026-04-03",
  requested_time_slot: "15:00-16:00",
  address_line1: "서울특별시 동작구 ...",
  address_line2: "101동 101호",
  customer_request: "머리와 뼈도 같이 부탁드립니다.",
  items: [
    {
      id: "item_demo_1",
      item_name: "광어",
      origin_label: "국산",
      size_band: "3kg급",
      quantity: "1",
      unit_label: "fish",
      requested_cut_type: "fillet",
      packing_option: "기본 냉장 포장 / 프리미엄 숙성지 / 진공포장 원해요"
    }
  ],
  quote: {
    id: "quote_demo_1",
    item_subtotal: "54000",
    processing_fee_total: "4000",
    delivery_fee_total: "7000",
    discount_total: "0",
    final_amount: "65000",
    receipt_type_note: "현금영수증 요청",
    payment_method_note: "계좌이체",
    quote_note: "당일택배 포함"
  },
  payment: {
    id: "pay_demo_1",
    expected_amount: "65000",
    paid_amount: "0",
    payment_status: "unpaid",
    confirmed_by_mode: null,
    confirmed_at: null,
    note: null
  },
  fulfillment: {
    id: "full_demo_1",
    fulfillment_type: "parcel",
    fulfillment_subtype: "parcel_same_day",
    fulfillment_status: "parcel_waiting",
    quick_dispatch_note: null,
    parcel_tracking_no: null,
    packing_note: "아이스팩 2개",
    handed_off_at: null
  },
  status_logs: [
    {
      id: "log_1",
      status_group: "order",
      from_status: null,
      to_status: "pricing_pending",
      reason: "주문서 제출",
      created_at: "2026-04-01T09:12:00+09:00"
    },
    {
      id: "log_2",
      status_group: "pricing",
      from_status: "quote_pending",
      to_status: "quoted",
      reason: "최종 금액 확정",
      created_at: "2026-04-01T09:33:00+09:00"
    }
  ]
};

export const demoPaymentReview: PaymentReviewItem[] = [
  {
    order_id: "ord_demo_4",
    order_no: "OB-20260401-021",
    customer_name: "이민수",
    expected_amount: "65000",
    review_reason: "동일 금액 주문 2건, 입금자명 불일치",
    transaction_candidates: [
      {
        id: "txn_demo_1",
        depositor_name: "박OO",
        amount: "65000",
        transaction_at: "2026-04-01T13:05:00+09:00"
      },
      {
        id: "txn_demo_2",
        depositor_name: "이민수",
        amount: "65000",
        transaction_at: "2026-04-01T13:17:00+09:00"
      }
    ]
  }
];

export const demoFulfillments: FulfillmentQueueItem[] = [
  {
    id: "full_queue_1",
    order_id: "ord_demo_2",
    order_no: "OB-20260401-014",
    customer_name: "김철수",
    fulfillment_type: "quick",
    fulfillment_subtype: null,
    fulfillment_status: "quick_waiting",
    parcel_tracking_no: null,
    requested_date: "2026-04-01"
  },
  {
    id: "full_queue_2",
    order_id: "ord_demo_1",
    order_no: "OB-20260401-013",
    customer_name: "홍길동",
    fulfillment_type: "parcel",
    fulfillment_subtype: "parcel_same_day",
    fulfillment_status: "parcel_waiting",
    parcel_tracking_no: null,
    requested_date: "2026-04-03"
  }
];
