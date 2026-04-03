import {
  AdminOrderDetail,
  AdminOrdersResponse,
  FulfillmentQueueItem,
  OrderFormOptions,
  PaymentReviewItem,
  PriceBoardResponse,
  PublicOrderResult,
  PublicOrderStatus,
  StoreInfo
} from "../types";

export const demoStore: StoreInfo = {
  name: "오늘바다 데모점",
  phones: ["010-1234-5678", "010-2345-6789"],
  bank_guide: {
    bank_name: "신한은행",
    bank_account: "110-123-456789",
    bank_holder: "오늘바다"
  },
  address: {
    line1: "서울시 동작구 예시로 123 수산타운 1층",
    line2: "A동 12호"
  },
  business_hours_note: "월~금 05:00~17:00 / 토 05:00~18:00 / 일 06:00~17:00"
};

export const demoPriceBoard: PriceBoardResponse = {
  board_date: "2026-04-01",
  items: [
    {
      id: "pb_1",
      item_name: "광어",
      origin_label: "국산",
      size_band: "3kg급",
      unit_price: "54000",
      unit_label: "fish",
      sale_status: "available",
      reservable_flag: true,
      reservation_cutoff_note: "오전 9:30 전 예약 권장"
    },
    {
      id: "pb_2",
      item_name: "보리숭어",
      origin_label: "국산",
      size_band: "1.2kg",
      unit_price: "38000",
      unit_label: "fish",
      sale_status: "reserved_only",
      reservable_flag: true,
      reservation_cutoff_note: "반절 주문 가능"
    },
    {
      id: "pb_3",
      item_name: "시마아지",
      origin_label: "일본산",
      size_band: "2kg급",
      unit_price: "40000",
      unit_label: "fish",
      sale_status: "sold_out",
      reservable_flag: false,
      reservation_cutoff_note: null
    }
  ],
  order_guide: {
    pickup_note: "직접 픽업은 방문 예정 시간 입력이 필요합니다.",
    quick_note: "카카오퀵은 픽업 2~3시간 전 주문이 권장됩니다.",
    parcel_note: "일반택배는 오로시/필렛 위주 권장, 회는 퀵 권장입니다.",
    processing_rules_summary: ["광어 오로시 kg당 2,000원", "회 손질 kg당 4,000원", "진공포장 가능"],
    cutoff_windows: [
      {
        fulfillment_type: "pickup",
        label: "매장 픽업",
        cutoff_note: "당일 픽업은 보통 오후 4시 전까지 주문 부탁드려요."
      },
      {
        fulfillment_type: "quick",
        label: "퀵 수령",
        cutoff_note: "퀵은 최소 2~3시간 전 주문 시 가장 안정적으로 맞춰드릴 수 있어요."
      },
      {
        fulfillment_type: "parcel",
        label: "택배 수령",
        cutoff_note: "당일택배는 오전 마감, 일반택배는 필렛/오로시 위주로 안내드려요."
      }
    ],
    expected_price_note:
      "시세에 따라 최종 금액은 달라질 수 있지만, 주문 전에 대략적인 금액 구조는 먼저 보실 수 있어요.",
    reservation_deposit_policy:
      "예약 주문은 물건 확보를 위해 예약금 안내 후 진행되며, 준비 완료 후 잔금을 다시 안내드려요."
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
