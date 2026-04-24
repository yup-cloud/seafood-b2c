import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoAdminOrderDetail } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDate, formatDateTime, formatItemName, formatStatusLabel } from "../lib/format";
import { AdminOrderDetail } from "../types";

interface QuoteFormState {
  itemSubtotal: string;
  processingFeeTotal: string;
  deliveryFeeTotal: string;
  discountTotal: string;
  finalAmount: string;
}

interface PaymentFormState {
  confirmedAmount: string;
  note: string;
}

interface FulfillmentFormState {
  fulfillmentStatus: string;
  fulfillmentSubtype: string;
  parcelTrackingNo: string;
  packingNote: string;
}

interface ToastState {
  message: string;
  type: "info" | "success" | "error";
}

const fulfillmentStatusOptions = [
  { value: "pickup_waiting", label: "픽업 대기" },
  { value: "quick_waiting", label: "퀵 대기" },
  { value: "quick_sent", label: "퀵 발송" },
  { value: "parcel_waiting", label: "택배 대기" },
  { value: "parcel_sent", label: "택배 발송" },
  { value: "pickup_done", label: "픽업 완료" }
];

// ✅ 개선: 숫자를 천원 단위 구분 포맷으로 표시
function formatNumberInput(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function parseNumberInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function parseAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const normalized = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateItemSubtotal(order: AdminOrderDetail): string {
  const subtotal = order.items.reduce((sum, item) => {
    const estimatedTotal = parseAmount(item.estimated_total);
    if (estimatedTotal > 0) return sum + estimatedTotal;
    const unitPrice = parseAmount(item.unit_price);
    const quantity = parseAmount(item.quantity);
    return sum + unitPrice * quantity;
  }, 0);
  return subtotal > 0 ? String(Math.round(subtotal)) : "";
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("copy_failed");
  }
}

function buildFulfillmentNotice(order: AdminOrderDetail, fulfillmentStatus: string, trackingNo: string) {
  const greeting = `${order.customer_name}님, ${order.order_no} 주문 안내입니다.`;

  if (fulfillmentStatus === "parcel_sent") {
    return [
      greeting,
      "택배 출고가 완료되었습니다.",
      trackingNo ? `송장번호: ${trackingNo}` : "송장번호는 확인 후 추가 안내드릴게요.",
      "상품 수령 후 냉장 보관해 주세요."
    ].join("\n");
  }

  if (fulfillmentStatus === "quick_sent") {
    return [
      greeting,
      "퀵으로 전달을 시작했습니다.",
      "도착 전 연락을 드리거나 기사님이 안내드릴 수 있습니다."
    ].join("\n");
  }

  if (fulfillmentStatus === "pickup_waiting") {
    return [
      greeting,
      "픽업 준비가 거의 마무리되었습니다.",
      "방문 가능 시간에 맞춰 매장으로 와 주세요."
    ].join("\n");
  }

  if (fulfillmentStatus === "pickup_done") {
    return [
      greeting,
      "픽업 완료로 처리되었습니다.",
      "이용해 주셔서 감사합니다."
    ].join("\n");
  }

  return [
    greeting,
    `${formatStatusLabel(fulfillmentStatus)} 상태로 업데이트되었습니다.`,
    "주문 상태 페이지에서도 같은 내용을 확인할 수 있습니다."
  ].join("\n");
}

export function AdminOrderPage() {
  const { orderId = "" } = useParams();
  const [order, setOrder] = useState<AdminOrderDetail>(demoAdminOrderDetail);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>({
    itemSubtotal: demoAdminOrderDetail.quote?.item_subtotal ?? "",
    processingFeeTotal: demoAdminOrderDetail.quote?.processing_fee_total ?? "",
    deliveryFeeTotal: demoAdminOrderDetail.quote?.delivery_fee_total ?? "",
    discountTotal: demoAdminOrderDetail.quote?.discount_total ?? "0",
    finalAmount: demoAdminOrderDetail.quote?.final_amount ?? ""
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    confirmedAmount: demoAdminOrderDetail.payment?.expected_amount ?? "",
    note: ""
  });
  const [fulfillmentForm, setFulfillmentForm] = useState<FulfillmentFormState>({
    fulfillmentStatus: demoAdminOrderDetail.fulfillment?.fulfillment_status ?? "parcel_waiting",
    fulfillmentSubtype: demoAdminOrderDetail.fulfillment?.fulfillment_subtype ?? "",
    parcelTrackingNo: demoAdminOrderDetail.fulfillment?.parcel_tracking_no ?? "",
    packingNote: demoAdminOrderDetail.fulfillment?.packing_note ?? ""
  });
  const [fulfillmentNoticeMessage, setFulfillmentNoticeMessage] = useState(
    buildFulfillmentNotice(
      demoAdminOrderDetail,
      demoAdminOrderDetail.fulfillment?.fulfillment_status ?? demoAdminOrderDetail.fulfillment_status,
      demoAdminOrderDetail.fulfillment?.parcel_tracking_no ?? ""
    )
  );

  // ✅ 개선: toast 자동 소멸 (4초 후)
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ✅ 개선: 원물+손질비+운임-할인 → 최종금액 자동 계산
  useEffect(() => {
    const subtotal = Number(quoteForm.itemSubtotal) || 0;
    const processingFee = Number(quoteForm.processingFeeTotal) || 0;
    const deliveryFee = Number(quoteForm.deliveryFeeTotal) || 0;
    const discount = Number(quoteForm.discountTotal) || 0;
    const computed = subtotal + processingFee + deliveryFee - discount;
    if (computed > 0) {
      setQuoteForm((current) => ({ ...current, finalAmount: String(computed) }));
    }
  }, [quoteForm.itemSubtotal, quoteForm.processingFeeTotal, quoteForm.deliveryFeeTotal, quoteForm.discountTotal]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const nextOrder = await api.getAdminOrder(orderId);
        if (cancelled) return;
        hydrateOrder(nextOrder, "live");
      } catch {
        if (cancelled) return;
        hydrateOrder(demoAdminOrderDetail, "demo");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    setFulfillmentNoticeMessage(
      buildFulfillmentNotice(order, fulfillmentForm.fulfillmentStatus, fulfillmentForm.parcelTrackingNo)
    );
  }, [fulfillmentForm.fulfillmentStatus, fulfillmentForm.parcelTrackingNo, order]);

  function showToast(message: string, type: ToastState["type"] = "info") {
    setToast({ message, type });
  }

  function hydrateOrder(nextOrder: AdminOrderDetail, nextMode: "live" | "demo") {
    setOrder(nextOrder);
    setMode(nextMode);
    const estimatedItemSubtotal = calculateItemSubtotal(nextOrder);
    setQuoteForm({
      itemSubtotal: nextOrder.quote?.item_subtotal ?? estimatedItemSubtotal,
      processingFeeTotal: nextOrder.quote?.processing_fee_total ?? "",
      deliveryFeeTotal: nextOrder.quote?.delivery_fee_total ?? "",
      discountTotal: nextOrder.quote?.discount_total ?? "0",
      finalAmount: nextOrder.quote?.final_amount ?? ""
    });
    setPaymentForm({
      confirmedAmount: nextOrder.payment?.expected_amount ?? "",
      note: nextOrder.payment?.note ?? ""
    });
    setFulfillmentForm({
      fulfillmentStatus: nextOrder.fulfillment?.fulfillment_status ?? nextOrder.fulfillment_status,
      fulfillmentSubtype: nextOrder.fulfillment?.fulfillment_subtype ?? nextOrder.fulfillment_subtype ?? "",
      parcelTrackingNo: nextOrder.fulfillment?.parcel_tracking_no ?? "",
      packingNote: nextOrder.fulfillment?.packing_note ?? ""
    });
    setFulfillmentNoticeMessage(
      buildFulfillmentNotice(
        nextOrder,
        nextOrder.fulfillment?.fulfillment_status ?? nextOrder.fulfillment_status,
        nextOrder.fulfillment?.parcel_tracking_no ?? ""
      )
    );
  }

  async function reloadOrder() {
    if (mode === "demo") {
      hydrateOrder(demoAdminOrderDetail, "demo");
      return;
    }
    const nextOrder = await api.getAdminOrder(orderId);
    hydrateOrder(nextOrder, "live");
  }

  async function handleQuoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "demo") {
      showToast("데모 모드입니다. API 서버 연결 후 저장 가능합니다.", "info");
      return;
    }
    try {
      await api.submitQuote(orderId, {
        item_subtotal: Number(quoteForm.itemSubtotal),
        processing_fee_total: Number(quoteForm.processingFeeTotal),
        delivery_fee_total: Number(quoteForm.deliveryFeeTotal),
        discount_total: Number(quoteForm.discountTotal),
        final_amount: Number(quoteForm.finalAmount),
        quote_note: "웹 관리자 화면에서 저장"
      });
      showToast("최종 금액을 저장했습니다.", "success");
      await reloadOrder();
    } catch {
      showToast("저장 중 오류가 발생했습니다. 다시 시도해 주세요.", "error");
    }
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "demo") {
      showToast("데모 모드입니다. API 서버 연결 후 실제 입금 확인 가능합니다.", "info");
      return;
    }
    try {
      await api.confirmPayment(orderId, Number(paymentForm.confirmedAmount), paymentForm.note);
      showToast("입금 확인을 반영했습니다.", "success");
      await reloadOrder();
    } catch {
      showToast("입금 확인 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleFulfillmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const noticeText = buildFulfillmentNotice(order, fulfillmentForm.fulfillmentStatus, fulfillmentForm.parcelTrackingNo);
    if (mode === "demo") {
      setFulfillmentNoticeMessage(noticeText);
      try {
        await copyTextToClipboard(noticeText);
        showToast("데모 모드입니다. 고객 안내 문구를 복사했습니다.", "info");
      } catch {
        showToast("데모 모드입니다. 안내 문구는 아래에서 직접 복사해 주세요.", "info");
      }
      return;
    }
    try {
      await api.updateFulfillment(orderId, {
        fulfillment_status: fulfillmentForm.fulfillmentStatus,
        fulfillment_subtype: fulfillmentForm.fulfillmentSubtype || undefined,
        parcel_tracking_no: fulfillmentForm.parcelTrackingNo || undefined,
        packing_note: fulfillmentForm.packingNote || undefined
      });
      setFulfillmentNoticeMessage(noticeText);
      try {
        await copyTextToClipboard(noticeText);
        showToast("출고 정보를 저장했고 고객 안내 문구를 복사했습니다.", "success");
      } catch {
        showToast("출고 정보를 저장했습니다. 고객 안내 문구는 아래에서 복사해 주세요.", "success");
      }
      await reloadOrder();
    } catch {
      showToast("출고 정보 저장 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleQuickPaymentConfirm() {
    if (mode === "demo") {
      showToast("데모 모드에서는 실제 입금 확인이 저장되지 않습니다.", "info");
      return;
    }
    const amount = Number(paymentForm.confirmedAmount || order.quote?.final_amount || 0);
    if (!amount) {
      showToast("확인 금액이 비어 있습니다. 먼저 최종 금액을 입력해 주세요.", "error");
      return;
    }
    try {
      await api.confirmPayment(orderId, amount, paymentForm.note || "운영자 빠른 확인");
      showToast("입금 확인을 반영하고 손질 준비 단계로 넘겼습니다.", "success");
      await reloadOrder();
    } catch {
      showToast("입금 확인 처리 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleQuickFulfillment(fulfillmentStatus: string) {
    setFulfillmentForm((current) => ({ ...current, fulfillmentStatus }));
    const noticeText = buildFulfillmentNotice(order, fulfillmentStatus, fulfillmentForm.parcelTrackingNo);
    if (mode === "demo") {
      setFulfillmentNoticeMessage(noticeText);
      showToast(`${formatStatusLabel(fulfillmentStatus)} 상태로 변경합니다. API 연결 후 실제 저장됩니다.`, "info");
      return;
    }
    try {
      await api.updateFulfillment(orderId, {
        fulfillment_status: fulfillmentStatus,
        fulfillment_subtype: fulfillmentForm.fulfillmentSubtype || undefined,
        parcel_tracking_no: fulfillmentForm.parcelTrackingNo || undefined,
        packing_note: fulfillmentForm.packingNote || undefined
      });
      setFulfillmentNoticeMessage(noticeText);
      try {
        await copyTextToClipboard(noticeText);
        showToast(`${formatStatusLabel(fulfillmentStatus)} 처리 후 고객 안내 문구를 복사했습니다.`, "success");
      } catch {
        showToast(`${formatStatusLabel(fulfillmentStatus)} 처리 완료`, "success");
      }
      await reloadOrder();
    } catch {
      showToast("상태 변경 중 오류가 발생했습니다.", "error");
    }
  }

  async function handleCopyFulfillmentNotice() {
    try {
      await copyTextToClipboard(fulfillmentNoticeMessage);
      showToast("고객 안내 문구를 복사했습니다.", "success");
    } catch {
      showToast("자동 복사가 되지 않았습니다. 안내 문구를 직접 복사해 주세요.", "error");
    }
  }

  // ✅ 개선: 로딩 상태
  if (loading) {
    return (
      <div className="page-content">
        <section className="page-hero compact">
          <div>
            <p className="eyebrow-text">주문 상세</p>
            <div className="skeleton" style={{ height: "2.2rem", width: "280px", marginTop: "8px" }} />
          </div>
        </section>
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* ✅ 개선: Toast 알림 */}
      {toast ? (
        <div className={`admin-toast admin-toast-${toast.type}`} role="alert" aria-live="assertive">
          {toast.message}
          <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="알림 닫기">×</button>
        </div>
      ) : null}

      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문 상세</p>
          <h1 className="page-title">{order.order_no}</h1>
          <p className="page-description">
            주문 상세에서 금액 확정, 입금 확인, 출고 처리까지 이어서 작업할 수 있습니다.
          </p>
        </div>
        <div className="hero-pills cluster">
          <span className={`mode-badge ${mode}`}>{mode === "live" ? "LIVE API" : "DEMO MODE"}</span>
          <StatusBadge value={order.order_status} />
          <StatusBadge value={order.payment_status} />
          <Link to="/admin" className="secondary-button compact-button">← 대시보드</Link>
        </div>
      </section>

      {/* ✅ 개선: 현장 빠른 처리 버튼 그룹 */}
      <SectionCard title="운영 빠른 처리" subtitle="현장에서 가장 많이 누르는 입금 확인과 출고 상태만 크게 분리했습니다.">
        <div className="quick-admin-grid">
          <button type="button" className="quick-admin-button primary" onClick={handleQuickPaymentConfirm}>
            <strong>입금 확인</strong>
            <span>
              {paymentForm.confirmedAmount || order.quote?.final_amount
                ? `${formatCurrency(paymentForm.confirmedAmount || order.quote?.final_amount)} 확인`
                : "금액 확인"}
            </span>
          </button>
          {fulfillmentStatusOptions.map((status) => (
            <button
              key={status.value}
              type="button"
              className={`quick-admin-button${fulfillmentForm.fulfillmentStatus === status.value ? " active" : ""}`}
              onClick={() => void handleQuickFulfillment(status.value)}
              aria-pressed={fulfillmentForm.fulfillmentStatus === status.value}
            >
              <strong>{status.label}</strong>
              <span>바로 상태 변경</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="split-layout admin-detail-layout">
        <div className="stacked-cards">
          {/* ── 주문 기본 정보 ─────────────────────────── */}
          <SectionCard title="주문 기본 정보" subtitle="고객과 수령 정보를 먼저 확인합니다.">
            <div className="detail-grid">
              <div className="detail-tile">
                <span>주문자</span>
                <strong>{order.customer_name}</strong>
                {/* ✅ 개선: 모바일에서 탭 전화 가능 */}
                <p>
                  <a href={`tel:${order.customer_phone}`} className="phone-link" aria-label={`${order.customer_name}에게 전화하기`}>
                    📞 {order.customer_phone}
                  </a>
                </p>
              </div>
              <div className="detail-tile">
                <span>수령 방식</span>
                <strong>{formatStatusLabel(order.fulfillment_type)}</strong>
                <p>{order.fulfillment_subtype ? formatStatusLabel(order.fulfillment_subtype) : "세부 유형 없음"}</p>
              </div>
              <div className="detail-tile">
                <span>희망 일정</span>
                <strong>{formatDate(order.requested_date)}</strong>
                <p>{order.requested_time_slot ?? "시간 미정"}</p>
              </div>
            </div>

            {/* ✅ 개선: 주소가 있을 때만 표시 */}
            {(order.address_line1 || order.customer_request) ? (
              <div className="address-card">
                {order.address_line1 ? (
                  <>
                    <strong>수령지</strong>
                    <p>
                      {order.address_line1} {order.address_line2 ?? ""}
                    </p>
                  </>
                ) : null}
                {order.customer_request ? (
                  <>
                    <strong>요청사항</strong>
                    <small>{order.customer_request}</small>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* ✅ 개선: 입금자명이 주문자와 다를 때 경고 표시 */}
            {order.depositor_name && order.depositor_name !== order.customer_name ? (
              <div className="notice-panel compact" role="note">
                <strong>⚠️ 입금 예정자명 다름:</strong> {order.depositor_name}
                <span className="text-muted"> (주문자: {order.customer_name})</span>
              </div>
            ) : null}
          </SectionCard>

          {/* ── 주문 품목 ────────────────────────────── */}
          <SectionCard title="주문 품목" subtitle="품목과 손질 요청을 검토합니다.">
            <div className="stack-list">
              {order.items.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{formatItemName(item.item_name)}</strong>
                    <p>
                      {item.origin_label ?? "원산지 미지정"} · {item.size_band ?? "규격 미지정"}
                    </p>
                  </div>
                  <div className="row-end">
                    <strong>
                      {item.quantity} {item.unit_label}
                    </strong>
                    <small>
                      {item.requested_cut_type ? formatStatusLabel(item.requested_cut_type) : "손질 없음"}
                      {item.packing_option ? ` · ${item.packing_option}` : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── 상태 로그 ────────────────────────────── */}
          <SectionCard title="상태 로그" subtitle="주문이 어떻게 변경되었는지 기록합니다.">
            {order.status_logs.length ? (
              <ol className="timeline-list compact-timeline">
                {order.status_logs.map((log) => (
                  <li key={log.id} className="timeline-step done">
                    <strong>{log.status_group}</strong>
                    <p>
                      {log.from_status ? `${formatStatusLabel(log.from_status)} → ` : ""}
                      {formatStatusLabel(log.to_status)}
                    </p>
                    <small>{formatDateTime(log.created_at)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="helper-text">아직 상태 변경 기록이 없습니다.</p>
            )}
          </SectionCard>
        </div>

        <div className="stacked-cards">
          {/* ── 정산 확정 ────────────────────────────── */}
          <SectionCard title="정산 확정" subtitle="최종 금액을 계산해서 입금 요청 상태로 전환합니다.">
            <form className="stack-form" onSubmit={handleQuoteSubmit}>
              <div className="form-grid two">
                <label className="field-block">
                  <span>원물금액</span>
                  <input
                    value={formatNumberInput(quoteForm.itemSubtotal)}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        itemSubtotal: parseNumberInput(event.target.value)
                      }))
                    }
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="원물금액 입력"
                  />
                  <span className="field-hint">주문서의 단가와 예상 금액을 기준으로 기본값을 채웁니다. 실제 중량 확인 후 수정할 수 있습니다.</span>
                </label>
                <label className="field-block">
                  <span>손질비</span>
                  <input
                    value={formatNumberInput(quoteForm.processingFeeTotal)}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        processingFeeTotal: parseNumberInput(event.target.value)
                      }))
                    }
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="손질비 입력"
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field-block">
                  <span>운임비</span>
                  <input
                    value={formatNumberInput(quoteForm.deliveryFeeTotal)}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        deliveryFeeTotal: parseNumberInput(event.target.value)
                      }))
                    }
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="운임비 입력"
                  />
                </label>
                <label className="field-block">
                  <span>할인</span>
                  <input
                    value={formatNumberInput(quoteForm.discountTotal)}
                    onChange={(event) =>
                      setQuoteForm((current) => ({
                        ...current,
                        discountTotal: parseNumberInput(event.target.value)
                      }))
                    }
                    inputMode="numeric"
                    placeholder="0"
                    aria-label="할인금액 입력"
                  />
                </label>
              </div>
              {/* ✅ 개선: 자동 계산 설명 + 천원 단위 구분 */}
              <label className="field-block">
                <span>최종 금액 <span className="auto-calc-badge">자동 계산</span></span>
                <input
                  value={formatNumberInput(quoteForm.finalAmount)}
                  onChange={(event) =>
                    setQuoteForm((current) => ({
                      ...current,
                      finalAmount: parseNumberInput(event.target.value)
                    }))
                  }
                  inputMode="numeric"
                  placeholder="0"
                  style={{ fontWeight: 700, fontSize: "1.08rem", color: "var(--blue-strong)" }}
                  aria-label="최종 금액"
                />
              </label>
              {/* ✅ 개선: 현재 저장 금액 vs 새 금액 비교 표시 */}
              <div className="summary-bar">
                <span>현재 저장된 금액</span>
                <strong style={{ color: order.quote?.final_amount ? "var(--text-strong)" : "var(--text-muted)" }}>
                  {order.quote?.final_amount ? formatCurrency(order.quote.final_amount) : "미확정"}
                </strong>
              </div>
              <button className="primary-button full-width" type="submit">
                최종 금액 저장 및 입금 요청
              </button>
            </form>
          </SectionCard>

          {/* ── 입금 확인 ────────────────────────────── */}
          <SectionCard title="입금 확인" subtitle="입금자명과 금액을 확인해 손질 준비로 넘깁니다.">
            <form className="stack-form" onSubmit={handlePaymentSubmit}>
              <div className="summary-bar">
                <span>현재 결제 상태</span>
                <StatusBadge value={order.payment_status} />
              </div>
              {/* ✅ 개선: 입금자명 표시 (입금 확인 시 대조용) */}
              {order.depositor_name ? (
                <div className="notice-panel compact">
                  <strong>입금 예정자명:</strong> {order.depositor_name}
                </div>
              ) : null}
              <label className="field-block">
                <span>확인 금액</span>
                <input
                  value={formatNumberInput(paymentForm.confirmedAmount)}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      confirmedAmount: parseNumberInput(event.target.value)
                    }))
                  }
                  inputMode="numeric"
                  placeholder="입금 확인된 금액"
                  aria-label="확인 금액 입력"
                />
              </label>
              <label className="field-block">
                <span>메모</span>
                <textarea
                  value={paymentForm.note}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="예: 입금자명 일치 확인"
                />
              </label>
              <button className="primary-button full-width" type="submit">
                입금 수동 확인
              </button>
            </form>
          </SectionCard>

          {/* ── 출고 처리 ────────────────────────────── */}
          <SectionCard title="출고 처리" subtitle="송장과 포장 메모를 저장하고 출고 상태를 바꿉니다.">
            <form className="stack-form" onSubmit={handleFulfillmentSubmit}>
              <label className="field-block">
                <span>출고 상태</span>
                <select
                  value={fulfillmentForm.fulfillmentStatus}
                  onChange={(event) =>
                    setFulfillmentForm((current) => ({ ...current, fulfillmentStatus: event.target.value }))
                  }
                >
                  {fulfillmentStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid two">
                <label className="field-block">
                  <span>택배 세부 유형</span>
                  <input
                    value={fulfillmentForm.fulfillmentSubtype}
                    onChange={(event) =>
                      setFulfillmentForm((current) => ({ ...current, fulfillmentSubtype: event.target.value }))
                    }
                    placeholder="예: 당일택배"
                  />
                </label>
                <label className="field-block">
                  <span>송장번호</span>
                  <input
                    value={fulfillmentForm.parcelTrackingNo}
                    onChange={(event) =>
                      setFulfillmentForm((current) => ({ ...current, parcelTrackingNo: event.target.value }))
                    }
                    placeholder="운송장 번호"
                    inputMode="numeric"
                  />
                </label>
              </div>
              <label className="field-block">
                <span>포장 메모</span>
                <textarea
                  value={fulfillmentForm.packingNote}
                  onChange={(event) =>
                    setFulfillmentForm((current) => ({ ...current, packingNote: event.target.value }))
                  }
                  placeholder="예: 아이스팩 2개, 신문지 추가"
                />
              </label>
              <button className="primary-button full-width" type="submit">
                출고 정보 저장
              </button>
            </form>
            <div className="notice-panel" style={{ marginTop: "12px" }}>
              <strong>고객 안내 문구</strong>
              <p>출고 저장 후 바로 보낼 수 있는 문구입니다. 저장 시 자동 복사를 시도합니다.</p>
            </div>
            <textarea
              className="kakao-notice-preview small"
              value={fulfillmentNoticeMessage}
              readOnly
              aria-label="출고 안내 문구"
            />
            <button type="button" className="secondary-button full-width" onClick={() => void handleCopyFulfillmentNotice()}>
              고객 안내 문구 복사
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
