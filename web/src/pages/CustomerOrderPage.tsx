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
  receiver_name: string;
  receiver_phone: string;
  postal_code: string;
  order_flow: "same_day" | "reservation";
  purchase_unit: "whole" | "half_request";
  fulfillment_type: string;
  fulfillment_subtype: string;
  requested_date: string;
  requested_time_slot: string;
  address_line1: string;
  address_line2: string;
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

const orderSteps = [
  { title: "어종 선택", description: "오늘 시세에서 담거나 예약 품목을 적습니다." },
  { title: "손질/수량", description: "몇 마리인지, 어떻게 손질할지 정합니다." },
  { title: "수령 방식", description: "픽업, 퀵, 택배 중 하나를 고릅니다." },
  { title: "연락처/수령 정보", description: "금액 안내와 수령에 필요한 정보만 입력합니다." },
  { title: "최종 확인", description: "예상 금액과 주문 내용을 마지막으로 확인합니다." }
];

const cutTypeLabels: Record<string, string> = {
  whole: "원물",
  fillet: "필렛",
  sashimi: "회 손질",
  masukawa: "마스까와",
  sekkoshi: "세꼬시"
};

const demoContactDefaults = {
  customer_name: "데모고객",
  customer_phone: "010-0000-0000",
  depositor_name: "데모고객",
  receiver_name: "데모고객",
  receiver_phone: "010-0000-0000",
  postal_code: "06900",
  address_line1: "서울시 동작구 데모로 1",
  address_line2: "101호"
};

const initialForm: OrderFormState = {
  ...demoContactDefaults,
  order_flow: "same_day",
  purchase_unit: "whole",
  fulfillment_type: "pickup",
  fulfillment_subtype: "parcel_standard",
  requested_date: getKoreaTodayDate(),
  requested_time_slot: "오늘 오후 3시 전후",
  customer_request: ""
};

function getKoreaTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul"
  }).format(new Date());
}

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseUnitPrice(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
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
  const numericUnitPrice = parseUnitPrice(item.unit_price);
  const weightRange = parseWeightRangeInKg(item.size_band);

  if (!numericUnitPrice || !weightRange) {
    return null;
  }

  return {
    min: numericUnitPrice * weightRange.min * item.quantity,
    max: numericUnitPrice * weightRange.max * item.quantity
  };
}

function getEstimatedAverage(item: SelectedOrderItem) {
  const estimate = estimateItemTotal(item);
  return estimate ? Math.round((estimate.min + estimate.max) / 2) : null;
}

function formatPriceRange(min: number, max: number) {
  if (min === max) {
    return formatCurrency(Math.round(min));
  }

  return `${formatCurrency(Math.round(min))} ~ ${formatCurrency(Math.round(max))}`;
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

function fulfillmentCopy(type: string, board: PriceBoardResponse) {
  if (type === "pickup") {
    return board.order_guide.pickup_note;
  }

  if (type === "quick") {
    return board.order_guide.quick_note;
  }

  return board.order_guide.parcel_note;
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
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
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const unitQuantity = form.purchase_unit === "half_request" ? 0.5 : 1;
  const cutTypes = options.cut_types.length ? options.cut_types : ["whole", "fillet", "sashimi"];
  const parcelSubtypes = options.parcel_subtypes.length ? options.parcel_subtypes : ["parcel_standard"];
  const fulfillmentTypes = options.fulfillment_types.length ? options.fulfillment_types : ["pickup", "quick", "parcel"];
  const isDelivery = form.fulfillment_type === "quick" || form.fulfillment_type === "parcel";
  const hasParcelSashimi = form.fulfillment_type === "parcel" && items.some((item) => item.requested_cut_type === "sashimi");
  const currentStepError = getStepError(currentStep);

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
          fulfillment_type:
            current.fulfillment_type || nextOptions.fulfillment_types[0] || initialForm.fulfillment_type,
          fulfillment_subtype:
            current.fulfillment_subtype || nextOptions.parcel_subtypes[0] || initialForm.fulfillment_subtype
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

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 60000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void load();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
      setCurrentStep(1);
    }

    setSubmitMessage("품목을 담아두었습니다. 손질, 받는 방법, 연락처만 확인해주세요.");
    setSearchParams({}, { replace: true });
  }, [board.items, searchParams, setSearchParams]);

  function updateField<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value
      };

      if (key === "fulfillment_type") {
        next.fulfillment_subtype = value === "parcel" ? current.fulfillment_subtype || parcelSubtypes[0] : "";
      }

      return next;
    });

    if (key === "purchase_unit") {
      const nextQuantity = value === "half_request" ? 0.5 : 1;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          quantity: item.quantity === 0.5 || item.quantity === 1 ? nextQuantity : item.quantity
        }))
      );
    }

    if (key === "fulfillment_type" && value === "parcel") {
      setItems((current) =>
        current.map((item) => ({
          ...item,
          requested_cut_type: item.requested_cut_type === "sashimi" ? "fillet" : item.requested_cut_type
        }))
      );
      setSubmitMessage("택배는 회 손질 접수가 어려워 필렛 기준으로 안내됩니다.");
    } else {
      setSubmitMessage("");
    }
  }

  function addBoardItem(boardItem: PriceBoardItem) {
    if (boardItem.sale_status === "sold_out") {
      setSubmitMessage("품절 품목은 바로 주문할 수 없습니다. 예약 주문으로 문의를 남겨주세요.");
      return;
    }

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
    setSubmitMessage("");
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
    setCurrentStep(1);
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function updateItem(itemId: string, updates: Partial<SelectedOrderItem>) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function handleCutChange(itemId: string, nextCutType: string) {
    if (form.fulfillment_type === "parcel" && nextCutType === "sashimi") {
      setSubmitMessage("택배는 회 손질을 선택할 수 없습니다. 필렛 또는 원물로 접수해주세요.");
      return;
    }

    updateItem(itemId, { requested_cut_type: nextCutType });
    setSubmitMessage("");
  }

  function getStepError(stepIndex: number): string {
    if (stepIndex === 0 && !items.length) {
      return "주문할 어종을 먼저 담아주세요.";
    }

    if (stepIndex === 1) {
      if (!items.length) {
        return "주문할 어종을 먼저 담아주세요.";
      }

      if (items.some((item) => item.quantity < 0.5)) {
        return "반마리는 0.5, 한 마리는 1 기준으로 접수됩니다.";
      }

      if (hasParcelSashimi) {
        return "택배는 회 손질을 선택할 수 없습니다. 필렛 또는 원물로 바꿔주세요.";
      }
    }

    if (stepIndex === 2) {
      if (!form.fulfillment_type) {
        return "수령 방식을 선택해주세요.";
      }

      if (form.fulfillment_type === "parcel" && !form.fulfillment_subtype) {
        return "택배 종류를 선택해주세요.";
      }

      if (hasParcelSashimi) {
        return "택배는 회 손질을 선택할 수 없습니다. 필렛 또는 원물로 바꿔주세요.";
      }
    }

    if (stepIndex === 3) {
      if (!form.customer_name.trim() || !form.customer_phone.trim()) {
        return "주문자 성함과 연락처를 입력해주세요.";
      }

      if (!form.requested_date.trim() || !form.requested_time_slot.trim()) {
        return "희망 날짜와 시간을 입력해주세요.";
      }

      if (isDelivery && (!form.receiver_name.trim() || !form.receiver_phone.trim())) {
        return "퀵/택배는 수령인명과 수령인 연락처가 필요합니다.";
      }

      if (isDelivery && !form.address_line1.trim()) {
        return "퀵/택배 받을 주소를 입력해주세요.";
      }

      if (form.fulfillment_type === "parcel" && !form.postal_code.trim()) {
        return "택배는 우편번호가 필요합니다.";
      }
    }

    if (stepIndex === 4) {
      const firstInvalid = findFirstInvalidStep();
      return firstInvalid === -1 ? "" : getStepError(firstInvalid);
    }

    return "";
  }

  function findFirstInvalidStep(): number {
    for (let index = 0; index < orderSteps.length - 1; index += 1) {
      if (getStepError(index)) {
        return index;
      }
    }

    return -1;
  }

  function handleNextStep() {
    const error = getStepError(currentStep);
    if (error) {
      setSubmitMessage(error);
      return;
    }

    setSubmitMessage("");
    setCurrentStep((current) => Math.min(current + 1, orderSteps.length - 1));
  }

  function handlePreviousStep() {
    setSubmitMessage("");
    setCurrentStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage("");

    const firstInvalidStep = findFirstInvalidStep();
    if (firstInvalidStep !== -1) {
      setCurrentStep(firstInvalidStep);
      setSubmitMessage(getStepError(firstInvalidStep));
      return;
    }

    setSubmitting(true);

    const payload: PublicOrderPayload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      depositor_name: normalizeOptional(form.depositor_name) ?? form.customer_name,
      purchase_unit: form.purchase_unit,
      requested_date: form.requested_date,
      requested_time_slot: form.requested_time_slot,
      fulfillment_type: form.fulfillment_type,
      fulfillment_subtype: form.fulfillment_type === "parcel" ? form.fulfillment_subtype || parcelSubtypes[0] : undefined,
      receiver_name: isDelivery ? form.receiver_name : undefined,
      receiver_phone: isDelivery ? form.receiver_phone : undefined,
      postal_code: form.fulfillment_type === "parcel" ? form.postal_code : undefined,
      address_line1: isDelivery ? form.address_line1 : undefined,
      address_line2: isDelivery ? form.address_line2 : undefined,
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
        packing_option: form.fulfillment_type === "parcel" ? "배송 포장" : "기본 추천 포장",
        unit_price: parseUnitPrice(item.unit_price) || null,
        estimated_total: getEstimatedAverage(item)
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

  function renderStepBody() {
    if (currentStep === 0) {
      return (
        <SectionCard title="1. 어종 선택" subtitle="오늘 시세에서 바로 담거나, 없는 품목은 예약 주문으로 남길 수 있습니다.">
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
              <span>없는 품목은 직접 요청</span>
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

          {form.order_flow === "same_day" ? (
            <div className="order-stage-block">
              <div className="order-stage-note">
                <strong>오늘 준비 가능한 품목</strong>
                <span>누르면 바로 주문서에 담깁니다. 품절은 예약 문의로 남겨주세요.</span>
              </div>
              <div className="market-item-grid">
                {board.items.length ? (
                  board.items.map((item) => (
                    <button
                      key={item.id ?? item.item_name}
                      type="button"
                      className={`market-item-card${item.sale_status === "sold_out" ? " disabled" : ""}`}
                      onClick={() => addBoardItem(item)}
                      disabled={item.sale_status === "sold_out"}
                    >
                      <span className="market-item-top">
                        <strong>{item.item_name}</strong>
                        <StatusBadge value={item.sale_status} />
                      </span>
                      <span>
                        {item.origin_label ?? "원산지 확인"} · {item.size_band ?? "크기 확인"}
                      </span>
                      <b>
                        {formatCurrency(item.unit_price)}
                        {item.unit_label === "kg" ? " / kg" : ""}
                      </b>
                      {item.note ? <small>{item.note}</small> : null}
                    </button>
                  ))
                ) : (
                  <div className="empty-order-card">오늘 시세가 아직 없으면 예약 주문으로 원하는 품목을 남겨주세요.</div>
                )}
              </div>
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
        </SectionCard>
      );
    }

    if (currentStep === 1) {
      return (
        <SectionCard title="2. 손질/수량" subtitle="반마리는 0.5, 한 마리는 1 기준입니다. 택배는 회 손질이 불가합니다.">
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
                          onChange={(event) =>
                            updateItem(item.id, { quantity: Number(event.target.value || unitQuantity) })
                          }
                        />
                      </label>
                      <label>
                        <span>손질</span>
                        <select
                          value={item.requested_cut_type}
                          onChange={(event) => handleCutChange(item.id, event.target.value)}
                        >
                          {cutTypes.map((cutType) => {
                            const disabled = form.fulfillment_type === "parcel" && cutType === "sashimi";
                            return (
                              <option key={cutType} value={cutType} disabled={disabled}>
                                {cutTypeLabels[cutType] ?? formatStatusLabel(cutType)}
                                {disabled ? " (택배 불가)" : ""}
                              </option>
                            );
                          })}
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
              <div className="empty-order-card">아직 담은 품목이 없습니다. 어종 선택 단계에서 먼저 담아주세요.</div>
            )}
          </div>

          <div className="order-warning-panel">
            <strong>손질 선택 기준</strong>
            <p>바로 드실 예정이면 회 손질, 이동이나 보관이 있으면 필렛을 권장합니다. 택배는 필렛 또는 원물로 접수해주세요.</p>
          </div>
        </SectionCard>
      );
    }

    if (currentStep === 2) {
      return (
        <SectionCard title="3. 수령 방식" subtitle="받는 방식에 따라 필요한 정보와 마감 시간이 달라집니다.">
          <div className="fulfillment-choice-grid">
            {fulfillmentTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`simple-choice-card${form.fulfillment_type === type ? " active" : ""}`}
                onClick={() => updateField("fulfillment_type", type)}
              >
                <strong>{formatStatusLabel(type)}</strong>
                <span>{fulfillmentCopy(type, board)}</span>
              </button>
            ))}
          </div>

          {form.fulfillment_type === "parcel" ? (
            <div className="delivery-fields">
              <label className="field-block">
                <span>택배 종류</span>
                <select
                  value={form.fulfillment_subtype}
                  onChange={(event) => updateField("fulfillment_subtype", event.target.value)}
                >
                  {parcelSubtypes.map((subtype) => (
                    <option key={subtype} value={subtype}>
                      {formatStatusLabel(subtype)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="order-warning-panel">
                <strong>택배 손질 제한</strong>
                <p>택배는 이동 시간이 있어 회 손질 대신 필렛 또는 원물 접수를 권장합니다.</p>
              </div>
            </div>
          ) : null}
        </SectionCard>
      );
    }

    if (currentStep === 3) {
      return (
        <SectionCard title="4. 연락처/수령 정보" subtitle="데모 기본값은 수정 가능합니다. 실제 주문에서는 정확한 연락처를 입력해주세요.">
          <div className="form-grid two">
            <label className="field-block">
              <span>주문자 성함</span>
              <input value={form.customer_name} onChange={(event) => updateField("customer_name", event.target.value)} />
            </label>
            <label className="field-block">
              <span>주문자 연락처</span>
              <input
                value={form.customer_phone}
                onChange={(event) => updateField("customer_phone", event.target.value)}
                placeholder="010-0000-0000"
              />
            </label>
          </div>

          <div className="form-grid two">
            <label className="field-block">
              <span>희망 날짜</span>
              <input
                type="date"
                value={form.requested_date}
                onChange={(event) => updateField("requested_date", event.target.value)}
              />
            </label>
            <label className="field-block">
              <span>희망 시간</span>
              <input
                value={form.requested_time_slot}
                onChange={(event) => updateField("requested_time_slot", event.target.value)}
                placeholder="예: 오후 3시 전후"
              />
            </label>
          </div>

          {isDelivery ? (
            <div className="delivery-fields">
              <div className="form-grid two">
                <label className="field-block">
                  <span>수령인명</span>
                  <input value={form.receiver_name} onChange={(event) => updateField("receiver_name", event.target.value)} />
                </label>
                <label className="field-block">
                  <span>수령인 연락처</span>
                  <input
                    value={form.receiver_phone}
                    onChange={(event) => updateField("receiver_phone", event.target.value)}
                    placeholder="010-0000-0000"
                  />
                </label>
              </div>
              {form.fulfillment_type === "parcel" ? (
                <label className="field-block compact">
                  <span>우편번호</span>
                  <input
                    value={form.postal_code}
                    onChange={(event) => updateField("postal_code", event.target.value)}
                    inputMode="numeric"
                  />
                </label>
              ) : null}
              <label className="field-block">
                <span>{form.fulfillment_type === "quick" ? "퀵 받을 주소" : "택배 기본 주소"}</span>
                <input value={form.address_line1} onChange={(event) => updateField("address_line1", event.target.value)} />
              </label>
              <label className="field-block">
                <span>상세 주소</span>
                <input value={form.address_line2} onChange={(event) => updateField("address_line2", event.target.value)} />
              </label>
            </div>
          ) : null}

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
            <input value={form.depositor_name} onChange={(event) => updateField("depositor_name", event.target.value)} />
          </label>
        </SectionCard>
      );
    }

    return (
      <SectionCard title="5. 최종 확인" subtitle="최종 금액은 실제 중량과 손질 조건 확인 후 다시 안내됩니다.">
        <div className="order-review-grid">
          <article className="order-review-card">
            <span>주문 품목</span>
            <strong>{items.length}개 품목</strong>
            <p>{items.map((item) => `${item.item_name} ${item.quantity}`).join(", ") || "품목 없음"}</p>
          </article>
          <article className="order-review-card">
            <span>수령 방식</span>
            <strong>{formatStatusLabel(form.fulfillment_type)}</strong>
            <p>
              {form.fulfillment_type === "parcel"
                ? formatStatusLabel(form.fulfillment_subtype)
                : form.fulfillment_type === "pickup"
                  ? "매장 방문 수령"
                  : "주소지 퀵 수령"}
            </p>
          </article>
          <article className="order-review-card">
            <span>연락처</span>
            <strong>{form.customer_name}</strong>
            <p>{form.customer_phone}</p>
          </article>
          <article className="order-review-card">
            <span>희망 일정</span>
            <strong>{form.requested_date}</strong>
            <p>{form.requested_time_slot}</p>
          </article>
        </div>

        <div className="estimate-breakdown">
          <div>
            <span>원물 예상</span>
            <strong>
              {estimates.itemRange.max > 0 ? formatPriceRange(estimates.itemRange.min, estimates.itemRange.max) : "확인 후 안내"}
            </strong>
          </div>
          <div>
            <span>손질비 예상</span>
            <strong>{estimates.processingFee > 0 ? formatCurrency(Math.round(estimates.processingFee)) : "없음 또는 확인"}</strong>
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
          <strong>{estimates.itemRange.max > 0 ? formatPriceRange(estimates.totalMin, estimates.totalMax) : "품목 확인 후 안내"}</strong>
          <p>주문번호가 발급되면 주문 확인 화면에서 바로 진행 상태를 볼 수 있습니다.</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <form className="page-content order-simple-page order-conversion-page" onSubmit={handleSubmit}>
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문하기</p>
          <h1 className="page-title">시세에서 고르고, 주문번호까지 바로 받으세요</h1>
          <p className="page-description">
            어종, 손질, 받는 방법만 순서대로 고르면 예상 금액과 함께 주문서가 완성됩니다.
          </p>
        </div>
        <div className="hero-pills">
          <span className="info-pill">{store.name}</span>
        </div>
      </section>

      <nav className="order-stepper" aria-label="주문 단계">
        {orderSteps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            className={`order-step-button${index === currentStep ? " active" : ""}${index < currentStep ? " done" : ""}`}
            onClick={() => {
              if (index <= currentStep) {
                setCurrentStep(index);
                setSubmitMessage("");
              }
            }}
          >
            <span className="order-step-index">{index + 1}</span>
            <span className="order-step-label">{step.title}</span>
          </button>
        ))}
      </nav>

      {renderStepBody()}

      {submitMessage ? <div className="notice-panel">{submitMessage}</div> : null}

      <div className="order-sticky-cta" aria-live="polite">
        <div className="order-sticky-copy">
          <span>
            {items.length}개 품목 · {orderSteps[currentStep].title}
          </span>
          <strong>
            {estimates.itemRange.max > 0 ? formatPriceRange(estimates.totalMin, estimates.totalMax) : "예상 금액 대기"}
          </strong>
          <small>{currentStepError || orderSteps[currentStep].description}</small>
        </div>
        <div className="order-sticky-actions">
          {currentStep > 0 ? (
            <button type="button" className="secondary-button compact-button" onClick={handlePreviousStep}>
              이전
            </button>
          ) : null}
          {currentStep < orderSteps.length - 1 ? (
            <button type="button" className="primary-button compact-button" onClick={handleNextStep}>
              다음
            </button>
          ) : (
            <button type="submit" className="primary-button compact-button" disabled={submitting}>
              {submitting ? "접수 중" : "주문 접수"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
