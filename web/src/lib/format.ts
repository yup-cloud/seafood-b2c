export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parsed);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }

  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    available: "주문 가능",
    reserved_only: "예약 문의",
    limited: "수량 한정",
    sold_out: "품절",
    preorder: "예약 가능",
    quote_pending: "금액 안내 대기",
    pricing_pending: "금액 확인 중",
    waiting_payment: "입금 기다리는 중",
    ready_for_prep: "손질 준비 시작",
    completed: "전달 완료",
    unpaid: "입금 전",
    quoted: "금액 안내 완료",
    manual_confirmed: "입금 확인 완료",
    payment_confirmed: "입금 확인 완료",
    payment_review_required: "입금 확인 필요",
    manual_review_required: "입금 확인 필요",
    pickup: "매장 픽업",
    quick: "퀵 배송",
    parcel: "택배 수령",
    parcel_standard: "일반 택배",
    parcel_same_day: "당일 택배",
    parcel_bus: "고속 택배",
    pickup_waiting: "픽업 준비 완료",
    pickup_done: "픽업 완료",
    quick_waiting: "퀵 배차 대기",
    quick_sent: "퀵 출발",
    parcel_waiting: "택배 발송 준비",
    parcel_sent: "택배 발송 완료",
    whole: "한 마리 전체",
    half: "반마리 함께 주문",
    half_request: "반마리 함께 주문",
    raw: "통손질",
    fillet: "포 뜨기",
    sashimi: "회 손질",
    round: "통손질",
    steak: "토막 손질",
    masukawa: "마스까와",
    sekkoshi: "세꼬시",
    vacuum: "진공 포장",
    ice_pack: "아이스 포장",
    same_day: "당일 택배",
    express: "고속 택배",
    regular: "일반 택배",
    match_not_needed: "매칭 불필요",
    matching_waiting: "반마리 같이 주문 찾는 중",
    matching_pending: "반마리 같이 주문 찾는 중",
    matched: "반마리 매칭 완료",
    cancelled: "주문 취소"
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

export function formatSourceModeLabel(value: "live" | "demo") {
  return value === "live" ? "실시간 연동" : "서비스 미리보기";
}
