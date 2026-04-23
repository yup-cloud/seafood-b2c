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

export function formatItemName(value: string | null | undefined): string {
  const original = (value ?? "").trim();
  if (!original) {
    return "";
  }

  const cleaned = original
    .replace(/^\s*(?:S{1,8}|A{1,4})(?:\s*급)?(?:\s+|[·ㆍ.,-]\s*)/i, "")
    .replace(/^\s*(?:S{1,8}|A{1,4})\s*급/i, "")
    .replace(/^\s*[★☆]+\s*급?\s*/u, "")
    .replace(/^\s*급\s+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || original;
}

export function formatItemNote(value: string | null | undefined): string {
  const original = (value ?? "").trim();
  if (!original) {
    return "";
  }

  const cleaned = original
    .replace(/^\s*(?:S{1,8}|A{1,4})(?:\s*급)?(?:\s+|[·ㆍ.,-]\s*)/i, "")
    .replace(/^\s*(?:S{1,8}|A{1,4})\s*급/i, "")
    .replace(/^\s*[★☆]+\s*급?\s*[·ㆍ.,-]?\s*/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || original;
}

export function formatProcessingRuleSummary(value: string): string {
  const cutTypeLabels: Record<string, string> = {
    raw: "원물 그대로",
    whole: "원물 그대로",
    round: "원물 그대로",
    fillet: "포 뜨기",
    sashimi: "회 작업",
    masukawa: "마스까와",
    sekkoshi: "세꼬시",
    steak: "토막 손질"
  };

  let formatted = value
    .replace(/\b(raw|whole|round|fillet|sashimi|masukawa|sekkoshi|steak)\b/g, (match) => cutTypeLabels[match] ?? match)
    .replace(/^공통\s+/, "")
    .replace(/개별문의/g, "개별 문의")
    .replace(/(\d+(?:\.\d+)?)원/g, (_, rawAmount: string) => {
      const amount = Number(rawAmount);
      return Number.isFinite(amount) ? `${amount.toLocaleString("ko-KR")}원` : `${rawAmount}원`;
    })
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!formatted.includes(":")) {
    formatted = formatted.replace(/\s+(kg당|마리당|개당)\s+/, ": $1 ");
  }

  return formatted;
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
    paid: "입금 확인 완료",
    pending: "확인 중",
    quoted: "금액 안내 완료",
    manual_confirmed: "입금 확인 완료",
    auto_confirmed: "입금 확인 완료",
    review_required: "확인 필요",
    partial_paid: "일부 입금",
    over_paid: "초과 입금",
    payment_confirmed: "입금 확인 완료",
    payment_review_required: "입금 확인 필요",
    manual_review_required: "입금 확인 필요",
    pickup: "매장 픽업",
    quick: "퀵 수령",
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
    whole: "한 마리",
    half: "반마리 주문",
    half_request: "반마리 주문",
    reservation_request: "예약 문의",
    raw: "원물 그대로",
    fillet: "포 뜨기",
    sashimi: "회 손질",
    round: "원물 그대로",
    steak: "토막 손질",
    masukawa: "마스까와",
    sekkoshi: "세꼬시",
    vacuum: "진공 포장",
    ice_pack: "아이스 포장",
    same_day: "당일 택배",
    express: "고속 택배",
    regular: "일반 택배",
    match_not_needed: "매칭 불필요",
    matching_waiting: "반마리 주문 매칭 중",
    matching_pending: "반마리 주문 매칭 중",
    matched: "반마리 매칭 완료",
    cancelled: "주문 취소"
  };

  return labels[value] ?? "확인 필요";
}

export function formatSourceModeLabel(value: "live" | "demo") {
  return value === "live" ? "실시간 연동" : "서비스 미리보기";
}
