import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import {
  demoOrderOptions,
  demoOrderResult,
  demoPriceBoard,
  demoStore
} from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatStatusLabel } from "../lib/format";
import { OrderFormOptions, PriceBoardResponse, PublicOrderPayload, StoreInfo } from "../types";
import { CustomerOrderItemCard } from "./CustomerOrderItemCard";
import {
  buildOrderItemDraft,
  formatPackingOption,
  getPackagingRecommendation,
  OrderItemFormState
} from "./customer-order.lib";

interface OrderFormState {
  customer_name: string;
  customer_phone: string;
  depositor_name: string;
  order_flow: string;
  purchase_unit: string;
  fulfillment_type: string;
  fulfillment_subtype: string;
  requested_date: string;
  requested_time_slot: string;
  receiver_name: string;
  receiver_phone: string;
  postal_code: string;
  address_line1: string;
  address_line2: string;
  customer_request: string;
}

const initialForm: OrderFormState = {
  customer_name: "",
  customer_phone: "",
  depositor_name: "",
  order_flow: "same_day",
  purchase_unit: "whole",
  fulfillment_type: "pickup",
  fulfillment_subtype: "",
  requested_date: "",
  requested_time_slot: "",
  receiver_name: "",
  receiver_phone: "",
  postal_code: "",
  address_line1: "",
  address_line2: "",
  customer_request: ""
};

export function CustomerOrderPage() {
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const [options, setOptions] = useState<OrderFormOptions>(demoOrderOptions);
  const [form, setForm] = useState<OrderFormState>(initialForm);
  const [items, setItems] = useState<OrderItemFormState[]>([
    buildOrderItemDraft({
      fulfillmentType: initialForm.fulfillment_type,
      requestedCutType: "fillet"
    })
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const matchedBoardItems = items
    .map((item) => ({
      item,
      boardItem: board.items.find((boardItem) => boardItem.item_name === item.item_name)
    }))
    .filter((entry) => entry.boardItem);
  const matchedSubtotal = matchedBoardItems.reduce((sum, entry) => {
    const unitPrice = Number(entry.boardItem?.unit_price ?? 0);
    return sum + unitPrice * Number(entry.item.quantity || 0);
  }, 0);
  const hasUnknownItems = items.some((item) => !board.items.some((boardItem) => boardItem.item_name === item.item_name));
  const processingEstimate = items.reduce((sum, item) => {
    switch (item.requested_cut_type) {
      case "fillet":
        return sum + 2000 * Number(item.quantity || 0);
      case "sashimi":
        return sum + 4000 * Number(item.quantity || 0);
      case "masukawa":
      case "sekkoshi":
        return sum + 3500 * Number(item.quantity || 0);
      default:
        return sum;
    }
  }, 0);
  const deliveryRange =
    form.fulfillment_type === "pickup"
      ? { min: 0, max: 0 }
      : form.fulfillment_type === "quick"
        ? { min: 8000, max: 18000 }
        : form.fulfillment_subtype === "parcel_same_day"
          ? { min: 12000, max: 18000 }
          : form.fulfillment_subtype === "parcel_bus"
            ? { min: 9000, max: 14000 }
            : { min: 7000, max: 10000 };
  const estimatedMin = matchedSubtotal + processingEstimate + deliveryRange.min;
  const estimatedMax = matchedSubtotal + processingEstimate + deliveryRange.max;
  const reservationDepositMin = Math.round(estimatedMin * 0.3);
  const reservationDepositMax = Math.round(estimatedMax * 0.3);
  const cutoffWindows = board.order_guide.cutoff_windows ?? [
    { fulfillment_type: "pickup", label: "매장 픽업", cutoff_note: board.order_guide.pickup_note },
    { fulfillment_type: "quick", label: "퀵 수령", cutoff_note: board.order_guide.quick_note },
    { fulfillment_type: "parcel", label: "택배 수령", cutoff_note: board.order_guide.parcel_note }
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextStore, nextBoard, nextOptions] = await Promise.all([
          api.getStore(),
          api.getPriceBoard(),
          api.getOrderOptions()
        ]);

        if (cancelled) {
          return;
        }

        const nextFulfillmentType = nextOptions.fulfillment_types[0] ?? "pickup";
        const nextCutType = nextOptions.cut_types[1] ?? nextOptions.cut_types[0] ?? "fillet";
        const firstBoardItem = nextBoard.items[0];

        setStore(nextStore);
        setBoard(nextBoard);
        setOptions(nextOptions);
        setForm((current) => ({
          ...current,
          purchase_unit: nextOptions.purchase_units[0] ?? "whole",
          fulfillment_type: nextFulfillmentType
        }));
        setItems([
          buildOrderItemDraft({
            fulfillmentType: nextFulfillmentType,
            requestedCutType: nextCutType,
            itemName: firstBoardItem?.item_name,
            sizeBand: firstBoardItem?.size_band ?? ""
          })
        ]);
      } catch {
        if (cancelled) {
          return;
        }

        const nextFulfillmentType = demoOrderOptions.fulfillment_types[0];
        const nextCutType = demoOrderOptions.cut_types[1];

        setStore(demoStore);
        setBoard(demoPriceBoard);
        setOptions(demoOrderOptions);
        setForm((current) => ({
          ...current,
          purchase_unit: demoOrderOptions.purchase_units[0],
          fulfillment_type: nextFulfillmentType
        }));
        setItems([
          buildOrderItemDraft({
            fulfillmentType: nextFulfillmentType,
            requestedCutType: nextCutType,
            itemName: demoPriceBoard.items[0].item_name,
            sizeBand: demoPriceBoard.items[0].size_band ?? ""
          })
        ]);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "fulfillment_type" && value !== "parcel" ? { fulfillment_subtype: "" } : {})
    }));

    if (key === "fulfillment_type") {
      const nextFulfillmentType = String(value);
      setItems((current) =>
        current.map((item) => {
          const recommendation = getPackagingRecommendation(item.requested_cut_type, nextFulfillmentType);
          return {
            ...item,
            packaging_style: recommendation.packaging_style,
            aging_sheet_type: recommendation.aging_sheet_type,
            vacuum_packaging: recommendation.vacuum_packaging
          };
        })
      );
    }
  }

  function updateItemField<K extends keyof OrderItemFormState>(
    itemId: string,
    key: K,
    value: OrderItemFormState[K]
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const next = {
          ...item,
          [key]: value
        };

        if (key === "requested_cut_type") {
          const recommended = getPackagingRecommendation(String(value), form.fulfillment_type);

          return {
            ...next,
            packaging_style: recommended.packaging_style,
            aging_sheet_type: recommended.aging_sheet_type,
            vacuum_packaging: recommended.vacuum_packaging
          };
        }

        if (key === "vacuum_packaging" && item.requested_cut_type !== "fillet" && value === "yes") {
          return {
            ...next,
            vacuum_packaging: "no"
          };
        }

        return next;
      })
    );
  }

  function addItem() {
    const defaultCutType = options.cut_types[1] ?? options.cut_types[0] ?? "fillet";

    setItems((current) => [
      ...current,
      buildOrderItemDraft({
        fulfillmentType: form.fulfillment_type,
        requestedCutType: defaultCutType
      })
    ]);
  }

  function removeItem(itemId: string) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.id !== itemId) : current));
  }

  function applyRecommendedPackaging(itemId: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? (() => {
              const recommendation = getPackagingRecommendation(
                item.requested_cut_type,
                form.fulfillment_type
              );

              return {
                ...item,
                packaging_style: recommendation.packaging_style,
                aging_sheet_type: recommendation.aging_sheet_type,
                vacuum_packaging: recommendation.vacuum_packaging
              };
            })()
          : item
      )
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage("");

    if (items.some((item) => !item.item_name.trim())) {
      setSubmitMessage("여러 품목을 함께 주문하실 수 있지만, 각 품목명은 모두 입력해주세요.");
      setSubmitting(false);
      return;
    }

    if (items.some((item) => Number(item.quantity || 0) < 1)) {
      setSubmitMessage("각 품목의 수량은 1 이상으로 입력해주세요.");
      setSubmitting(false);
      return;
    }

    if (form.fulfillment_type === "parcel" && items.some((item) => item.requested_cut_type === "sashimi")) {
      setSubmitMessage("회 손질은 택배로 직접 접수할 수 없어요. 픽업 또는 퀵 수령으로 바꾸거나 필렛/통손질을 선택해주세요.");
      setSubmitting(false);
      return;
    }

    const payload: PublicOrderPayload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      depositor_name: form.depositor_name,
      purchase_unit: form.purchase_unit,
      requested_date: form.requested_date,
      requested_time_slot: form.requested_time_slot,
      fulfillment_type: form.fulfillment_type,
      fulfillment_subtype: form.fulfillment_type === "parcel" ? form.fulfillment_subtype : undefined,
      receiver_name: form.receiver_name || undefined,
      receiver_phone: form.receiver_phone || undefined,
      postal_code: form.postal_code || undefined,
      address_line1: form.address_line1 || undefined,
      address_line2: form.address_line2 || undefined,
      customer_request: [
        form.order_flow === "reservation" ? "[주문유형] 예약 주문" : "[주문유형] 당일 주문",
        form.order_flow === "reservation"
          ? "[결제흐름] 예약금 안내 후 진행, 이후 잔금 결제"
          : "[결제흐름] 최종 금액 확정 후 결제",
        form.customer_request.trim()
      ]
        .filter(Boolean)
        .join("\n"),
      items: items.map((item) => ({
        item_name: item.item_name,
        size_band: item.size_band || undefined,
        quantity: Number(item.quantity || 1),
        unit_label: "fish",
        requested_cut_type: item.requested_cut_type || undefined,
        packing_option: formatPackingOption(item)
      }))
    };

    try {
      const result = await api.createOrder(payload);
      navigate(`/customer/status?token=${encodeURIComponent(result.public_token)}`);
    } catch {
      setSubmitMessage("지금은 서비스 미리보기 화면으로 연결돼 있어, 예시 주문 내역으로 안내해드릴게요.");
      navigate(`/customer/status?token=${encodeURIComponent(demoOrderResult.public_token)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문하기</p>
          <h1 className="page-title">여러 품목도 한 번에 정리해서 주문하실 수 있어요</h1>
          <p className="page-description">
            품목을 하나씩 더 담고, 받는 방법에 맞는 손질과 포장 추천까지 함께 보면서 주문하실 수
            있어요.
          </p>
        </div>
        <div className="hero-pills">
          <span className="info-pill">{store.name}</span>
        </div>
      </section>

      <div className="split-layout wide-main">
        <SectionCard title="오늘 준비 가능한 품목" subtitle="시세와 준비 가능 여부를 먼저 확인해보세요.">
          <div className="stack-list">
            {board.items.map((item) => (
              <div key={item.id ?? item.item_name} className="list-row">
                <div>
                  <strong>{item.item_name}</strong>
                  <p>
                    {item.origin_label ?? "원산지 미지정"} · {item.size_band ?? "규격 미지정"}
                  </p>
                </div>
                <div className="row-end">
                  <strong>{formatCurrency(item.unit_price)}</strong>
                  <StatusBadge value={item.sale_status} />
                </div>
              </div>
            ))}
          </div>
          <div className="notice-panel">
            <p>매장 픽업: {board.order_guide.pickup_note}</p>
            <p>퀵 배송: {board.order_guide.quick_note}</p>
            <p>택배 수령: {board.order_guide.parcel_note}</p>
          </div>
          <div className="cutoff-grid compact">
            {cutoffWindows.map((cutoff) => (
              <article key={cutoff.fulfillment_type} className="cutoff-card">
                <p className="cutoff-card-label">{cutoff.label}</p>
                <strong>{cutoff.cutoff_note}</strong>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="주문서 남기기" subtitle="한 주문서 안에서 여러 품목을 함께 담으실 수 있어요.">
          <form className="order-form" onSubmit={handleSubmit}>
            <div className="form-grid two">
              <label className="field-block">
                <span>주문하시는 분</span>
                <input value={form.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} required />
              </label>
              <label className="field-block">
                <span>연락받을 번호</span>
                <input value={form.customer_phone} onChange={(event) => updateField("customer_phone", event.target.value)} placeholder="확인 연락을 드릴 번호" required />
              </label>
            </div>

            <label className="field-block">
              <span>입금 예정자명</span>
              <input value={form.depositor_name} onChange={(event) => updateField("depositor_name", event.target.value)} placeholder="주문자명과 다르면 적어주세요" />
            </label>

            <div className="choice-section">
              <div className="choice-section-head">
                <strong>이번 주문은 어떤 방식으로 진행할까요?</strong>
                <p>오늘 바로 받는 주문인지, 내일 이후를 위한 예약 주문인지 먼저 골라주세요.</p>
              </div>
              <div className="choice-grid two">
                <button
                  type="button"
                  className={`choice-card${form.order_flow === "same_day" ? " active" : ""}`}
                  onClick={() => updateField("order_flow", "same_day")}
                  aria-pressed={form.order_flow === "same_day"}
                >
                  <strong>오늘 바로 진행할 주문</strong>
                  <span>당일 시세와 손질 조건을 확인해 최종 금액 안내 후 바로 준비해드려요.</span>
                </button>
                <button
                  type="button"
                  className={`choice-card${form.order_flow === "reservation" ? " active" : ""}`}
                  onClick={() => updateField("order_flow", "reservation")}
                  aria-pressed={form.order_flow === "reservation"}
                >
                  <strong>내일 이후 예약 주문</strong>
                  <span>물건 확보가 필요한 주문은 예약금 안내 후 진행하고, 준비 완료 후 잔금을 안내드려요.</span>
                </button>
              </div>
            </div>

            <div className="form-grid three">
              <label className="field-block">
                <span>이번 주문 방식</span>
                <select value={form.purchase_unit} onChange={(event) => updateField("purchase_unit", event.target.value)}>
                  {options.purchase_units.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit === "whole" ? "한 마리 전체" : "반마리 같이 주문"}
                    </option>
                  ))}
                </select>
                <p className="field-hint">여러 품목을 담아도 이번 주문 전체에 공통 적용돼요.</p>
              </label>
              <label className="field-block">
                <span>받는 방법</span>
                <select value={form.fulfillment_type} onChange={(event) => updateField("fulfillment_type", event.target.value)}>
                  {options.fulfillment_types.map((type) => (
                    <option key={type} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span>택배 종류</span>
                <select
                  value={form.fulfillment_subtype}
                  onChange={(event) => updateField("fulfillment_subtype", event.target.value)}
                  disabled={form.fulfillment_type !== "parcel"}
                >
                  <option value="">선택 안 함</option>
                  {options.parcel_subtypes.map((subtype) => (
                    <option key={subtype} value={subtype}>
                      {formatStatusLabel(subtype)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="estimate-panel">
              <div className="estimate-panel-head">
                <div>
                  <strong>예상 금액 구조를 먼저 안내드릴게요</strong>
                  <p>품목 선택 기준으로 대략적인 범위를 먼저 보여드리고, 실제 준비 전 최종 금액을 다시 확정해드려요.</p>
                </div>
                <span className="mini-pill">
                  {form.order_flow === "reservation" ? "예약금 진행형" : "최종 금액 확정형"}
                </span>
              </div>
              <div className="summary-grid">
                <div className="summary-tile">
                  <span>원물 시세 합계</span>
                  <strong>{matchedSubtotal > 0 ? formatCurrency(String(matchedSubtotal)) : "확인 후 안내"}</strong>
                </div>
                <div className="summary-tile">
                  <span>손질비 예상</span>
                  <strong>{processingEstimate > 0 ? formatCurrency(String(processingEstimate)) : "손질 선택 후 안내"}</strong>
                </div>
                <div className="summary-tile">
                  <span>운임비 예상</span>
                  <strong>
                    {deliveryRange.max > 0
                      ? `${formatCurrency(String(deliveryRange.min))} ~ ${formatCurrency(String(deliveryRange.max))}`
                      : "없음"}
                  </strong>
                </div>
              </div>
              <div className="estimate-total-card">
                <span>예상 총액</span>
                <strong>
                  {matchedSubtotal > 0
                    ? `${formatCurrency(String(estimatedMin))} ~ ${formatCurrency(String(estimatedMax))}`
                    : "선택하신 품목 확인 후 안내"}
                </strong>
                <p>
                  {form.purchase_unit === "half_request"
                    ? "반마리 함께 주문은 매칭과 실제 사이즈 확인 후 최종 금액이 달라질 수 있어요."
                    : "실제 경락 상황과 사이즈, 손질 조건에 따라 최종 금액은 조정될 수 있어요."}
                </p>
              </div>
              {form.order_flow === "reservation" ? (
                <div className="reservation-guide-card">
                  <strong>예약 주문 안내</strong>
                  <p>
                    예약 주문은 물건 확보를 위해 예약금 안내 후 진행돼요.
                    {matchedSubtotal > 0
                      ? ` 현재 기준 예상 예약금은 ${formatCurrency(String(reservationDepositMin))} ~ ${formatCurrency(String(reservationDepositMax))} 정도예요.`
                      : " 품목 확인 후 예약금 금액을 안내해드려요."}
                  </p>
                  <p>{board.order_guide.reservation_deposit_policy ?? "준비 완료 후 잔금을 다시 안내해드려요."}</p>
                </div>
              ) : null}
              {hasUnknownItems ? (
                <p className="field-hint">시세표에 없는 품목은 대략 금액 계산에서 제외되고, 확인 후 따로 안내드려요.</p>
              ) : null}
            </div>

            <div className="order-items-section">
              <div className="order-items-head">
                <div>
                  <strong>주문 품목</strong>
                  <p>품목별로 손질과 포장 추천이 달라지므로, 필요한 만큼 차례대로 담아보세요.</p>
                </div>
                <button type="button" className="secondary-button compact-button" onClick={addItem}>
                  품목 추가
                </button>
              </div>

              <div className="item-list">
                {items.map((item, index) => (
                  <CustomerOrderItemCard
                    key={item.id}
                    item={item}
                    index={index}
                    totalItems={items.length}
                    fulfillmentType={form.fulfillment_type}
                    cutTypes={options.cut_types}
                    onRemove={removeItem}
                    onUpdate={updateItemField}
                    onApplyRecommendation={applyRecommendedPackaging}
                  />
                ))}
              </div>
            </div>

            <div className="form-grid two">
              <label className="field-block">
                <span>{form.order_flow === "reservation" ? "받고 싶은 날짜" : "가능하면 받고 싶은 날짜"}</span>
                <input type="date" value={form.requested_date} onChange={(event) => updateField("requested_date", event.target.value)} required={form.order_flow === "reservation"} />
              </label>
              <label className="field-block">
                <span>받고 싶은 시간대</span>
                <input value={form.requested_time_slot} onChange={(event) => updateField("requested_time_slot", event.target.value)} placeholder="예: 오후 3시 전후" />
              </label>
            </div>

            <div className="form-grid two">
              <label className="field-block">
                <span>받는 분 성함</span>
                <input value={form.receiver_name} onChange={(event) => updateField("receiver_name", event.target.value)} />
              </label>
              <label className="field-block">
                <span>받는 분 연락처</span>
                <input value={form.receiver_phone} onChange={(event) => updateField("receiver_phone", event.target.value)} />
              </label>
            </div>

            <div className="form-grid two">
              <label className="field-block">
                <span>우편번호</span>
                <input value={form.postal_code} onChange={(event) => updateField("postal_code", event.target.value)} />
              </label>
              <label className="field-block">
                <span>상세 주소</span>
                <input value={form.address_line2} onChange={(event) => updateField("address_line2", event.target.value)} />
              </label>
            </div>

            <label className="field-block">
              <span>주소</span>
              <input value={form.address_line1} onChange={(event) => updateField("address_line1", event.target.value)} />
            </label>

            <label className="field-block">
              <span>추가로 남기실 말씀</span>
              <textarea value={form.customer_request} onChange={(event) => updateField("customer_request", event.target.value)} placeholder="예: 뼈와 머리도 같이 부탁드려요. 문 앞 수령 원해요." />
            </label>

            <div className="warning-stack">
              <p>당일 경락 상황에 따라 품목과 크기는 먼저 확인 후 최종 확정될 수 있어요.</p>
              <p>여러 품목을 담으셔도 한 주문으로 묶여 안내되며, 품목별 손질과 포장 요청은 각각 반영돼요.</p>
              {options.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>

            {submitMessage ? <div className="notice-panel">{submitMessage}</div> : null}

            <button type="submit" className="primary-button full-width" disabled={submitting}>
              {submitting ? "주문서 보내는 중..." : "주문서 보내기"}
            </button>
          </form>
          <datalist id="item-options">
            {board.items.map((item) => (
              <option key={item.id ?? item.item_name} value={item.item_name} />
            ))}
          </datalist>
        </SectionCard>
      </div>
    </div>
  );
}
