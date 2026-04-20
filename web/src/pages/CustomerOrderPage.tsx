import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoOrderOptions, demoOrderResult, demoPriceBoard, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatStatusLabel } from "../lib/format";
import { OrderFormOptions, PriceBoardItem, PriceBoardResponse, PublicOrderPayload, StoreInfo } from "../types";

interface OrderFormState {
  customer_name: string;
  customer_phone: string;
  depositor_name: string;
  order_flow: "same_day" | "reservation";
  purchase_unit: "whole" | "half_request";
  fulfillment_type: string;
  fulfillment_subtype: string;
  requested_date: string;
  requested_time_slot: string;
  address_line1: string;
  customer_request: string;
}

interface SelectedOrderItem {
  id: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  unit_price: string | null;
  unit_label: string;
  sale_status: string;
  quantity: number;
  requested_cut_type: string;
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
  address_line1: "",
  customer_request: ""
};

const cutTypeLabels: Record<string, string> = {
  whole: "원물",
  fillet: "필렛",
  sashimi: "회 손질",
  masukawa: "마스까와",
  sekkoshi: "세꼬시"
};

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseWeightRangeInKg(sizeBand: string | null | undefined) {
  if (!sizeBand || sizeBand.includes("미")) {
    return null;
  }

  const values = Array.from(sizeBand.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));
  if (!values.length) {
    return null;
  }

  if (sizeBand.includes("~") && values.length >= 2) {
    return { min: values[0], max: values[1] };
  }

  return { min: values[0], max: values[0] };
}

function estimateItemTotal(item: SelectedOrderItem) {
  const numericUnitPrice = Number(item.unit_price ?? 0);
  const weightRange = parseWeightRangeInKg(item.size_band);

  if (!numericUnitPrice || !weightRange) {
    return null;
  }

  return {
    min: numericUnitPrice * weightRange.min * item.quantity,
    max: numericUnitPrice * weightRange.max * item.quantity
  };
}

function formatPriceRange(min: number, max: number) {
  if (min === max) {
    return formatCurrency(String(Math.round(min)));
  }

  return `${formatCurrency(String(Math.round(min)))} ~ ${formatCurrency(String(Math.round(max)))}`;
}

function buildSelectedItem(boardItem: PriceBoardItem, quantity: number, cutType = "fillet"): SelectedOrderItem {
  return {
    id: makeItemId(),
    item_name: boardItem.item_name,
    origin_label: boardItem.origin_label,
    size_band: boardItem.size_band,
    unit_price: boardItem.unit_price,
    unit_label: boardItem.unit_label,
    sale_status: boardItem.sale_status,
    quantity,
    requested_cut_type: cutType
  };
}

function buildCustomItem(itemName: string, quantity: number): SelectedOrderItem {
  return {
    id: makeItemId(),
    item_name: itemName,
    origin_label: null,
    size_band: null,
    unit_price: null,
    unit_label: "fish",
    sale_status: "reservation_request",
    quantity,
    requested_cut_type: "fillet"
  };
}

export function CustomerOrderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const [options, setOptions] = useState<OrderFormOptions>(demoOrderOptions);
  const [form, setForm] = useState<OrderFormState>(initialForm);
  const [items, setItems] = useState<SelectedOrderItem[]>([]);
  const [reservationItemName, setReservationItemName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const unitQuantity = form.purchase_unit === "half_request" ? 0.5 : 1;
  const cutTypes = options.cut_types.length ? options.cut_types : ["whole", "fillet", "sashimi"];
  const cutoffWindows = board.order_guide.cutoff_windows ?? [
    { fulfillment_type: "pickup", label: "픽업", cutoff_note: board.order_guide.pickup_note },
    { fulfillment_type: "quick", label: "퀵", cutoff_note: board.order_guide.quick_note },
    { fulfillment_type: "parcel", label: "택배", cutoff_note: board.order_guide.parcel_note }
  ];

  const estimates = useMemo(() => {
    const itemRange = items.reduce(
      (sum, item) => {
        const next = estimateItemTotal(item);
        if (!next) {
          return sum;
        }

        return {
          min: sum.min + next.min,
          max: sum.max + next.max
        };
      },
      { min: 0, max: 0 }
    );

    const processingFee = items.reduce((sum, item) => {
      const feePerUnit =
        item.requested_cut_type === "sashimi"
          ? 4000
          : item.requested_cut_type === "masukawa" || item.requested_cut_type === "sekkoshi"
            ? 5000
            : item.requested_cut_type === "fillet"
              ? 2000
              : 0;

      return sum + feePerUnit * item.quantity;
    }, 0);

    const deliveryRange =
      form.fulfillment_type === "pickup"
        ? { min: 0, max: 0 }
        : form.fulfillment_type === "quick"
          ? { min: 8000, max: 18000 }
          : form.fulfillment_subtype === "parcel_same_day"
            ? { min: 12000, max: 18000 }
            : { min: 7000, max: 10000 };

    return {
      itemRange,
      processingFee,
      deliveryRange,
      totalMin: itemRange.min + processingFee + deliveryRange.min,
      totalMax: itemRange.max + processingFee + deliveryRange.max
    };
  }, [form.fulfillment_subtype, form.fulfillment_type, items]);

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

        setStore(nextStore);
        setBoard(nextBoard);
        setOptions(nextOptions);
        setForm((current) => ({
          ...current,
          fulfillment_type: nextOptions.fulfillment_types[0] ?? current.fulfillment_type
        }));
      } catch {
        if (cancelled) {
          return;
        }

        setStore(demoStore);
        setBoard(demoPriceBoard);
        setOptions(demoOrderOptions);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const halfRequested = searchParams.get("half") === "1";
    const presetFlow = searchParams.get("flow");
    const presetItem = searchParams.get("item");

    if (!halfRequested && !presetFlow && !presetItem) {
      return;
    }

    setForm((current) => ({
      ...current,
      order_flow: presetFlow === "reservation" ? "reservation" : current.order_flow,
      purchase_unit: halfRequested ? "half_request" : current.purchase_unit
    }));

    if (presetItem) {
      const boardItem = board.items.find((item) => item.item_name === presetItem);
      setItems([
        boardItem
          ? buildSelectedItem(boardItem, halfRequested ? 0.5 : 1)
          : buildCustomItem(presetItem, halfRequested ? 0.5 : 1)
      ]);
    }

    setSubmitMessage("반마리 기준으로 주문서를 시작했습니다. 받는 방법과 연락처만 확인해주세요.");
    setSearchParams({}, { replace: true });
  }, [board.items, searchParams, setSearchParams]);

  function updateField<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "fulfillment_type" && value !== "parcel" ? { fulfillment_subtype: "" } : {})
    }));

    if (key === "purchase_unit") {
      const nextQuantity = value === "half_request" ? 0.5 : 1;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          quantity: item.quantity === 0.5 || item.quantity === 1 ? nextQuantity : item.quantity
        }))
      );
    }
  }

  function addBoardItem(boardItem: PriceBoardItem) {
    setItems((current) => {
      const existing = current.find((item) => item.item_name === boardItem.item_name);
      if (!existing) {
        return [...current, buildSelectedItem(boardItem, unitQuantity)];
      }

      return current.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              quantity: Number((item.quantity + unitQuantity).toFixed(1))
            }
          : item
      );
    });
  }

  function addReservationItem() {
    const trimmedName = reservationItemName.trim();
    if (!trimmedName) {
      setSubmitMessage("예약으로 찾을 품목명을 입력해주세요.");
      return;
    }

    setItems((current) => [...current, buildCustomItem(trimmedName, unitQuantity)]);
    setReservationItemName("");
    setSubmitMessage("");
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function updateItem(itemId: string, updates: Partial<SelectedOrderItem>) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage("");

    if (!items.length) {
      setSubmitMessage("먼저 주문할 품목을 하나 이상 담아주세요.");
      return;
    }

    if (items.some((item) => item.quantity < 0.5)) {
      setSubmitMessage("반마리는 0.5, 한 마리는 1 기준으로 접수됩니다.");
      return;
    }

    setSubmitting(true);

    const payload: PublicOrderPayload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      depositor_name: form.depositor_name || form.customer_name,
      purchase_unit: form.purchase_unit,
      requested_date: form.requested_date,
      requested_time_slot: form.requested_time_slot,
      fulfillment_type: form.fulfillment_type,
      fulfillment_subtype: form.fulfillment_type === "parcel" ? form.fulfillment_subtype : undefined,
      address_line1: form.address_line1 || undefined,
      customer_request: [
        form.order_flow === "reservation" ? "[주문유형] 예약 주문" : "[주문유형] 당일 주문",
        form.purchase_unit === "half_request" ? "[반마리] 매칭 가능 여부 확인 요청" : "",
        form.customer_request.trim()
      ]
        .filter(Boolean)
        .join("\n"),
      items: items.map((item) => ({
        item_name: item.item_name,
        origin_label: item.origin_label,
        size_band: item.size_band,
        quantity: item.quantity,
        unit_label: item.unit_label,
        requested_cut_type: item.requested_cut_type,
        packing_option: "기본 추천 포장"
      }))
    };

    try {
      const result = await api.createOrder(payload);
      navigate(`/customer/status?orderNo=${encodeURIComponent(result.order_no)}&submitted=1`);
    } catch {
      setSubmitMessage("지금은 미리보기 환경이라 예시 주문 확인 화면으로 이동합니다.");
      navigate(`/customer/status?token=${encodeURIComponent(demoOrderResult.public_token)}&submitted=1`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="page-content order-simple-page" onSubmit={handleSubmit}>
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문하기</p>
          <h1 className="page-title">시세에서 고르고, 필요한 정보만 남기세요</h1>
          <p className="page-description">처음 주문해도 품목, 받는 방법, 연락처만 정하면 접수할 수 있습니다.</p>
        </div>
        <div className="hero-pills">
          <span className="info-pill">{store.name}</span>
        </div>
      </section>

      <SectionCard title="1. 주문 기준" subtitle="오늘 바로 주문할지, 예약으로 찾을지 먼저 선택합니다.">
        <div className="order-toggle-grid">
          <button
            type="button"
            className={`simple-choice-card${form.order_flow === "same_day" ? " active" : ""}`}
            onClick={() => updateField("order_flow", "same_day")}
          >
            <strong>오늘 주문</strong>
            <span>시세표 품목에서 바로 선택</span>
          </button>
          <button
            type="button"
            className={`simple-choice-card${form.order_flow === "reservation" ? " active" : ""}`}
            onClick={() => updateField("order_flow", "reservation")}
          >
            <strong>예약 주문</strong>
            <span>원하는 품목을 직접 요청</span>
          </button>
          <button
            type="button"
            className={`simple-choice-card${form.purchase_unit === "whole" ? " active" : ""}`}
            onClick={() => updateField("purchase_unit", "whole")}
          >
            <strong>한 마리</strong>
            <span>기본 수량 1</span>
          </button>
          <button
            type="button"
            className={`simple-choice-card${form.purchase_unit === "half_request" ? " active" : ""}`}
            onClick={() => updateField("purchase_unit", "half_request")}
          >
            <strong>반마리</strong>
            <span>기본 수량 0.5</span>
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="2. 품목 담기"
        subtitle={form.order_flow === "same_day" ? "오늘 준비 가능한 품목을 눌러 담으세요." : "예약으로 찾을 품목을 적어주세요."}
      >
        {form.order_flow === "same_day" ? (
          <div className="market-item-grid">
            {board.items.map((item) => (
              <button
                key={item.id ?? item.item_name}
                type="button"
                className="market-item-card"
                onClick={() => addBoardItem(item)}
              >
                <span className="market-item-top">
                  <strong>{item.item_name}</strong>
                  <StatusBadge value={item.sale_status} />
                </span>
                <span>{item.origin_label ?? "원산지 확인"} · {item.size_band ?? "크기 확인"}</span>
                <b>
                  {formatCurrency(item.unit_price)}
                  {item.unit_label === "kg" ? " / kg" : ""}
                </b>
              </button>
            ))}
          </div>
        ) : (
          <div className="reservation-input-row">
            <label className="field-block">
              <span>찾는 품목</span>
              <input
                value={reservationItemName}
                onChange={(event) => setReservationItemName(event.target.value)}
                placeholder="예: 연어 반마리, 돌돔 2kg급"
              />
            </label>
            <button type="button" className="primary-button" onClick={addReservationItem}>
              담기
            </button>
          </div>
        )}

        <div className="selected-order-list">
          {items.length ? (
            items.map((item) => {
              const estimate = estimateItemTotal(item);

              return (
                <article key={item.id} className="selected-order-card">
                  <div>
                    <strong>{item.item_name}</strong>
                    <p>
                      {item.origin_label ?? "원산지 확인"} · {item.size_band ?? "크기 확인"}
                    </p>
                    <span>{estimate ? formatPriceRange(estimate.min, estimate.max) : "금액 확인 후 안내"}</span>
                  </div>
                  <div className="selected-order-controls">
                    <label>
                      <span>수량</span>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value || unitQuantity) })}
                      />
                    </label>
                    <label>
                      <span>손질</span>
                      <select
                        value={item.requested_cut_type}
                        onChange={(event) => updateItem(item.id, { requested_cut_type: event.target.value })}
                      >
                        {cutTypes.map((cutType) => (
                          <option key={cutType} value={cutType}>
                            {cutTypeLabels[cutType] ?? formatStatusLabel(cutType)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" className="text-danger-button" onClick={() => removeItem(item.id)}>
                      삭제
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-order-card">아직 담은 품목이 없습니다.</div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="3. 받는 방법" subtitle="픽업, 퀵, 택배 중 하나만 고르면 됩니다.">
        <div className="fulfillment-choice-grid">
          {options.fulfillment_types.map((type) => (
            <button
              key={type}
              type="button"
              className={`simple-choice-card${form.fulfillment_type === type ? " active" : ""}`}
              onClick={() => updateField("fulfillment_type", type)}
            >
              <strong>{formatStatusLabel(type)}</strong>
              <span>
                {cutoffWindows.find((cutoff) => cutoff.fulfillment_type === type)?.cutoff_note ?? "가능 여부 확인"}
              </span>
            </button>
          ))}
        </div>

        {form.fulfillment_type === "parcel" ? (
          <label className="field-block">
            <span>택배 종류</span>
            <select
              value={form.fulfillment_subtype}
              onChange={(event) => updateField("fulfillment_subtype", event.target.value)}
            >
              <option value="">확인 후 안내</option>
              {options.parcel_subtypes.map((subtype) => (
                <option key={subtype} value={subtype}>
                  {formatStatusLabel(subtype)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </SectionCard>

      <SectionCard title="4. 연락처와 요청사항" subtitle="금액 안내를 받을 연락처만 정확히 남겨주세요.">
        <div className="form-grid two">
          <label className="field-block">
            <span>성함</span>
            <input value={form.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} required />
          </label>
          <label className="field-block">
            <span>연락처</span>
            <input
              value={form.customer_phone}
              onChange={(event) => updateField("customer_phone", event.target.value)}
              placeholder="010-0000-0000"
              required
            />
          </label>
        </div>
        <div className="form-grid two">
          <label className="field-block">
            <span>희망 날짜</span>
            <input type="date" value={form.requested_date} onChange={(event) => updateField("requested_date", event.target.value)} />
          </label>
          <label className="field-block">
            <span>희망 시간</span>
            <input value={form.requested_time_slot} onChange={(event) => updateField("requested_time_slot", event.target.value)} placeholder="예: 오후 3시 전후" />
          </label>
        </div>
        <label className="field-block">
          <span>주소</span>
          <input
            value={form.address_line1}
            onChange={(event) => updateField("address_line1", event.target.value)}
            placeholder={form.fulfillment_type === "pickup" ? "픽업이면 비워두셔도 됩니다" : "퀵/택배 받을 주소"}
            required={form.fulfillment_type !== "pickup"}
          />
        </label>
        <label className="field-block">
          <span>요청사항</span>
          <textarea
            value={form.customer_request}
            onChange={(event) => updateField("customer_request", event.target.value)}
            placeholder="예: 뼈도 같이 주세요. 4시 전에 받고 싶어요."
          />
        </label>
        <label className="field-block">
          <span>입금 예정자명</span>
          <input
            value={form.depositor_name}
            onChange={(event) => updateField("depositor_name", event.target.value)}
            placeholder="성함과 같으면 비워두셔도 됩니다"
          />
        </label>
      </SectionCard>

      <SectionCard title="예상 금액" subtitle="최종 금액은 실제 중량과 손질 조건 확인 후 다시 안내됩니다.">
        <div className="estimate-breakdown">
          <div>
            <span>원물 예상</span>
            <strong>{estimates.itemRange.max > 0 ? formatPriceRange(estimates.itemRange.min, estimates.itemRange.max) : "품목 선택 후 안내"}</strong>
          </div>
          <div>
            <span>손질비 예상</span>
            <strong>{estimates.processingFee > 0 ? formatCurrency(String(Math.round(estimates.processingFee))) : "없음 또는 확인"}</strong>
          </div>
          <div>
            <span>운임 예상</span>
            <strong>
              {estimates.deliveryRange.max > 0
                ? formatPriceRange(estimates.deliveryRange.min, estimates.deliveryRange.max)
                : "픽업 무료"}
            </strong>
          </div>
        </div>
        <div className="estimate-total-card">
          <span>대략 총액</span>
          <strong>
            {estimates.itemRange.max > 0 ? formatPriceRange(estimates.totalMin, estimates.totalMax) : "품목을 담으면 보여드려요"}
          </strong>
          <p>반마리 주문은 매칭과 실제 사이즈에 따라 금액이 달라질 수 있습니다.</p>
        </div>

        {submitMessage ? <div className="notice-panel">{submitMessage}</div> : null}

        <button type="submit" className="primary-button full-width" disabled={submitting}>
          {submitting ? "주문서 보내는 중..." : "주문서 보내기"}
        </button>
      </SectionCard>
    </form>
  );
}
