import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoAdminOrderDetail } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDate, formatDateTime, formatStatusLabel } from "../lib/format";
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

const fulfillmentStatusOptions = [
  { value: "pickup_waiting", label: "픽업 대기" },
  { value: "quick_waiting", label: "퀵 대기" },
  { value: "quick_sent", label: "퀵 발송" },
  { value: "parcel_waiting", label: "택배 대기" },
  { value: "parcel_sent", label: "택배 발송" },
  { value: "pickup_done", label: "픽업 완료" }
];

export function AdminOrderPage() {
  const { orderId = "" } = useParams();
  const [order, setOrder] = useState<AdminOrderDetail>(demoAdminOrderDetail);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [notice, setNotice] = useState("");
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextOrder = await api.getAdminOrder(orderId);
        if (cancelled) {
          return;
        }
        hydrateOrder(nextOrder, "live");
      } catch {
        if (cancelled) {
          return;
        }
        hydrateOrder(demoAdminOrderDetail, "demo");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  function hydrateOrder(nextOrder: AdminOrderDetail, nextMode: "live" | "demo") {
    setOrder(nextOrder);
    setMode(nextMode);
    setQuoteForm({
      itemSubtotal: nextOrder.quote?.item_subtotal ?? "",
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
      setNotice("현재는 데모 모드입니다. 실제 견적 저장은 API 서버 실행 후 가능합니다.");
      return;
    }

    await api.submitQuote(orderId, {
      item_subtotal: Number(quoteForm.itemSubtotal),
      processing_fee_total: Number(quoteForm.processingFeeTotal),
      delivery_fee_total: Number(quoteForm.deliveryFeeTotal),
      discount_total: Number(quoteForm.discountTotal),
      final_amount: Number(quoteForm.finalAmount),
      quote_note: "웹 관리자 화면에서 저장"
    });
    setNotice("최종 금액을 저장했습니다.");
    await reloadOrder();
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "demo") {
      setNotice("현재는 데모 모드입니다. 실제 입금 확인은 API 서버 실행 후 가능합니다.");
      return;
    }

    await api.confirmPayment(orderId, Number(paymentForm.confirmedAmount), paymentForm.note);
    setNotice("입금 확인을 반영했습니다.");
    await reloadOrder();
  }

  async function handleFulfillmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "demo") {
      setNotice("현재는 데모 모드입니다. 실제 출고 수정은 API 서버 실행 후 가능합니다.");
      return;
    }

    await api.updateFulfillment(orderId, {
      fulfillment_status: fulfillmentForm.fulfillmentStatus,
      fulfillment_subtype: fulfillmentForm.fulfillmentSubtype || undefined,
      parcel_tracking_no: fulfillmentForm.parcelTrackingNo || undefined,
      packing_note: fulfillmentForm.packingNote || undefined
    });
    setNotice("출고 정보를 저장했습니다.");
    await reloadOrder();
  }

  async function handleQuickPaymentConfirm() {
    if (mode === "demo") {
      setNotice("데모 모드에서는 실제 입금 확인이 저장되지 않습니다. API 서버 연결 후 바로 반영됩니다.");
      return;
    }

    const amount = Number(paymentForm.confirmedAmount || order.quote?.final_amount || 0);
    if (!amount) {
      setNotice("확인 금액이 비어 있습니다. 먼저 최종 금액을 입력해주세요.");
      return;
    }

    await api.confirmPayment(orderId, amount, paymentForm.note || "운영자 빠른 확인");
    setNotice("입금 확인을 반영하고 손질 준비 단계로 넘겼습니다.");
    await reloadOrder();
  }

  async function handleQuickFulfillment(fulfillmentStatus: string) {
    setFulfillmentForm((current) => ({
      ...current,
      fulfillmentStatus
    }));

    if (mode === "demo") {
      setNotice(`${formatStatusLabel(fulfillmentStatus)} 상태로 바꾸는 빠른 처리 버튼입니다. API 서버 연결 후 저장됩니다.`);
      return;
    }

    await api.updateFulfillment(orderId, {
      fulfillment_status: fulfillmentStatus,
      fulfillment_subtype: fulfillmentForm.fulfillmentSubtype || undefined,
      parcel_tracking_no: fulfillmentForm.parcelTrackingNo || undefined,
      packing_note: fulfillmentForm.packingNote || undefined
    });
    setNotice(`${formatStatusLabel(fulfillmentStatus)} 상태로 저장했습니다.`);
    await reloadOrder();
  }

  return (
    <div className="page-content">
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
        </div>
      </section>

      {notice ? <div className="banner-notice">{notice}</div> : null}

      <SectionCard title="운영 빠른 처리" subtitle="현장에서 가장 많이 누르는 입금 확인과 출고 상태만 크게 분리했습니다.">
        <div className="quick-admin-grid">
          <button type="button" className="quick-admin-button primary" onClick={handleQuickPaymentConfirm}>
            <strong>입금 확인</strong>
            <span>{formatCurrency(paymentForm.confirmedAmount || order.quote?.final_amount)} 확인</span>
          </button>
          {fulfillmentStatusOptions.map((status) => (
            <button
              key={status.value}
              type="button"
              className={`quick-admin-button${fulfillmentForm.fulfillmentStatus === status.value ? " active" : ""}`}
              onClick={() => void handleQuickFulfillment(status.value)}
            >
              <strong>{status.label}</strong>
              <span>바로 상태 변경</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="split-layout admin-detail-layout">
        <div className="stacked-cards">
          <SectionCard title="주문 기본 정보" subtitle="고객과 수령 정보를 먼저 확인합니다.">
            <div className="detail-grid">
              <div className="detail-tile">
                <span>주문자</span>
                <strong>{order.customer_name}</strong>
                <p>{order.customer_phone}</p>
              </div>
              <div className="detail-tile">
                <span>수령 방식</span>
                <strong>{order.fulfillment_type}</strong>
                <p>{order.fulfillment_subtype ?? "세부 유형 없음"}</p>
              </div>
              <div className="detail-tile">
                <span>희망 일정</span>
                <strong>{formatDate(order.requested_date)}</strong>
                <p>{order.requested_time_slot ?? "시간 미정"}</p>
              </div>
            </div>
            <div className="address-card">
              <strong>수령지</strong>
              <p>
                {order.address_line1 ?? "주소 미입력"} {order.address_line2 ?? ""}
              </p>
              <small>{order.customer_request ?? "추가 요청사항 없음"}</small>
            </div>
          </SectionCard>

          <SectionCard title="주문 품목" subtitle="품목과 손질 요청을 검토합니다.">
            <div className="stack-list">
              {order.items.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.item_name}</strong>
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

          <SectionCard title="상태 로그" subtitle="주문이 어떻게 변경되었는지 기록합니다.">
            <ol className="timeline-list compact-timeline">
              {order.status_logs.map((log) => (
                <li key={log.id} className="timeline-step done">
                  <strong>{log.status_group}</strong>
                  <p>
                    {log.from_status ? `${log.from_status} → ` : ""}
                    {log.to_status}
                  </p>
                  <small>{formatDateTime(log.created_at)}</small>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <div className="stacked-cards">
          <SectionCard title="정산 확정" subtitle="최종 금액을 계산해서 입금 요청 상태로 전환합니다.">
            <form className="stack-form" onSubmit={handleQuoteSubmit}>
              <div className="form-grid two">
                <label className="field-block">
                  <span>원물금액</span>
                  <input value={quoteForm.itemSubtotal} onChange={(event) => setQuoteForm((current) => ({ ...current, itemSubtotal: event.target.value }))} />
                </label>
                <label className="field-block">
                  <span>손질비</span>
                  <input value={quoteForm.processingFeeTotal} onChange={(event) => setQuoteForm((current) => ({ ...current, processingFeeTotal: event.target.value }))} />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field-block">
                  <span>운임비</span>
                  <input value={quoteForm.deliveryFeeTotal} onChange={(event) => setQuoteForm((current) => ({ ...current, deliveryFeeTotal: event.target.value }))} />
                </label>
                <label className="field-block">
                  <span>할인</span>
                  <input value={quoteForm.discountTotal} onChange={(event) => setQuoteForm((current) => ({ ...current, discountTotal: event.target.value }))} />
                </label>
              </div>
              <label className="field-block">
                <span>최종 금액</span>
                <input value={quoteForm.finalAmount} onChange={(event) => setQuoteForm((current) => ({ ...current, finalAmount: event.target.value }))} />
              </label>
              <div className="summary-bar">
                <span>현재 저장된 금액</span>
                <strong>{formatCurrency(order.quote?.final_amount)}</strong>
              </div>
              <button className="primary-button full-width" type="submit">
                최종 금액 저장
              </button>
            </form>
          </SectionCard>

          <SectionCard title="입금 확인" subtitle="입금자명과 금액을 확인해 손질 준비로 넘깁니다.">
            <form className="stack-form" onSubmit={handlePaymentSubmit}>
              <div className="summary-bar">
                <span>현재 결제 상태</span>
                <StatusBadge value={order.payment_status} />
              </div>
              <label className="field-block">
                <span>확인 금액</span>
                <input value={paymentForm.confirmedAmount} onChange={(event) => setPaymentForm((current) => ({ ...current, confirmedAmount: event.target.value }))} />
              </label>
              <label className="field-block">
                <span>메모</span>
                <textarea value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} placeholder="예: 입금자명 일치 확인" />
              </label>
              <button className="primary-button full-width" type="submit">
                입금 수동 확인
              </button>
            </form>
          </SectionCard>

          <SectionCard title="출고 처리" subtitle="송장과 포장 메모를 저장하고 출고 상태를 바꿉니다.">
            <form className="stack-form" onSubmit={handleFulfillmentSubmit}>
              <label className="field-block">
                <span>출고 상태</span>
                <select value={fulfillmentForm.fulfillmentStatus} onChange={(event) => setFulfillmentForm((current) => ({ ...current, fulfillmentStatus: event.target.value }))}>
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
                  <input value={fulfillmentForm.fulfillmentSubtype} onChange={(event) => setFulfillmentForm((current) => ({ ...current, fulfillmentSubtype: event.target.value }))} />
                </label>
                <label className="field-block">
                  <span>송장번호</span>
                  <input value={fulfillmentForm.parcelTrackingNo} onChange={(event) => setFulfillmentForm((current) => ({ ...current, parcelTrackingNo: event.target.value }))} />
                </label>
              </div>
              <label className="field-block">
                <span>포장 메모</span>
                <textarea value={fulfillmentForm.packingNote} onChange={(event) => setFulfillmentForm((current) => ({ ...current, packingNote: event.target.value }))} />
              </label>
              <button className="primary-button full-width" type="submit">
                출고 정보 저장
              </button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
