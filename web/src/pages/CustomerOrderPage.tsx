import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoOrderOptions, demoOrderResult, demoPriceBoard, demoStore } from "../data/demo";
import { api, isNetworkError } from "../lib/api";
import { formatCurrency, formatItemName, formatItemNote, formatStatusLabel } from "../lib/format";
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

interface FulfillmentConflict {
  targetType: string;
  conflicts: Array<{
    id: string;
    itemName: string;
    fromCut: string;
    toCut: string;
  }>;
}

type TouchedFields = Partial<Record<keyof OrderFormState, boolean>>;

const orderSteps = [
  { title: "어종 선택", description: "오늘 시세에서 담거나 예약 품목을 적습니다." },
  { title: "수령 방식", description: "픽업, 퀵, 택배 중 하나를 먼저 고릅니다." },
  { title: "손질/수량", description: "수령 방식에 맞는 손질과 수량을 정합니다." },
  { title: "연락처/수령 정보", description: "금액 안내와 수령에 필요한 정보만 입력합니다." },
  { title: "최종 확인", description: "예상 금액과 주문 내용을 마지막으로 확인합니다." }
];

const cutTypeLabels: Record<string, string> = {
  whole: "원물",
  raw: "원물",
  fillet: "필렛",
  sashimi: "회 손질",
  round: "원물",
  steak: "토막 손질",
  masukawa: "마스까와",
  sekkoshi: "세꼬시"
};

const cutTypeDescriptions: Record<string, string> = {
  whole: "손질 없이 통째로",
  raw: "손질 없이 통째로",
  fillet: "뼈 제거, 포 뜬 상태 · 택배 가능",
  sashimi: "먹기 좋게 썰어드림 · 당일 수령 권장",
  round: "손질 없이 통째로",
  steak: "조리하기 좋게 토막 손질",
  masukawa: "껍질 제거 후 회 손질",
  sekkoshi: "잔뼈째 얇게 써는 방식"
};

const fulfillmentChoiceDetails: Record<string, { cost: string; timing: string }> = {
  pickup: { cost: "운임 없음", timing: "방문 시간만 알려주세요" },
  quick: { cost: "8,000~18,000원", timing: "당일 최소 2~3시간" },
  parcel: { cost: "7,000~18,000원", timing: "당일 9시 30분 전" }
};

const timeSlotOptions = [
  { label: "오전 10시", value: "오전 10시 전후" },
  { label: "오전 11시", value: "오전 11시 전후" },
  { label: "정오", value: "정오 전후" },
  { label: "오후 2시", value: "오후 2시 전후" },
  { label: "오후 4시", value: "오후 4시 전후" },
  { label: "오후 6시", value: "오후 6시 전후" },
  { label: "저녁 7시 이후", value: "저녁 7시 이후" }
];

const initialForm: OrderFormState = {
  customer_name: "",
  customer_phone: "",
  depositor_name: "",
  receiver_name: "",
  receiver_phone: "",
  postal_code: "",
  order_flow: "same_day",
  purchase_unit: "whole",
  fulfillment_type: "pickup",
  fulfillment_subtype: "parcel_standard",
  requested_date: getKoreaTodayDate(),
  requested_time_slot: "",
  address_line1: "",
  address_line2: "",
  customer_request: ""
};

function getKoreaTodayDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function getKoreaTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(tomorrow);
}

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseUnitPrice(value: string | null | undefined) {
  if (!value) return 0;
  const cleaned = String(value).trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    return Math.round(Number(cleaned.replace(/,/g, "")));
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    return Math.round(Number(cleaned.replace(/\./g, "").replace(",", ".")));
  }

  if (/^\d+[.,]\d+$/.test(cleaned)) {
    const parsed = Number(cleaned.replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  const digits = cleaned.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseWeightRangeInKg(sizeBand: string | null | undefined) {
  if (!sizeBand || sizeBand.includes("미")) return null;
  const values = Array.from(sizeBand.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));
  if (!values.length) return null;
  if (sizeBand.includes("~") && values.length >= 2) return { min: values[0], max: values[1] };
  return { min: values[0], max: values[0] };
}

function estimateItemTotal(item: SelectedOrderItem) {
  const numericUnitPrice = parseUnitPrice(item.unit_price);
  const weightRange = parseWeightRangeInKg(item.size_band);
  if (!numericUnitPrice || !weightRange) return null;
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
  if (min === max) return formatCurrency(Math.round(min));
  return `${formatCurrency(Math.round(min))} ~ ${formatCurrency(Math.round(max))}`;
}

function formatUnitPriceLabel(value: string | null, unitLabel: string) {
  const numericUnitPrice = parseUnitPrice(value);
  if (!numericUnitPrice) return "시세 확인";
  return `${formatCurrency(numericUnitPrice)}${unitLabel === "kg" ? " / kg" : ""}`;
}

function formatQuantityLabel(quantity: number) {
  const normalized = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);
  return `${normalized}마리`;
}

function formatCompactQuantityValue(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace(/\.0$/, "");
}

function formatCompactAmount(value: number) {
  if (value >= 10000) {
    const man = value / 10000;
    const compact = man >= 10 ? Math.round(man).toString() : man.toFixed(1).replace(/\.0$/, "");
    return `${compact}만`;
  }
  return formatCurrency(Math.round(value));
}

function formatCompactItemPrice(item: SelectedOrderItem) {
  const estimate = estimateItemTotal(item);
  if (!estimate) return "금액 안내";
  const average = Math.round((estimate.min + estimate.max) / 2);
  return formatCompactAmount(average);
}

function formatReservationDateLabel(date: string) {
  if (!date) return "";
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${Number(month)}월 ${Number(day)}일 희망`;
}

function serializeReservationItemName(itemName: string, size: string, date: string) {
  return [
    formatItemName(itemName),
    size.trim(),
    formatReservationDateLabel(date)
  ]
    .filter(Boolean)
    .join(" / ");
}

function getSpeciesLabel(itemName: string | null | undefined) {
  const cleanedName = formatItemName(itemName)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/^(?:자연산|양식|활|선어|냉장|생물)\s+/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleanedName || formatItemName(itemName);
}

function compareBoardItemVariants(left: PriceBoardItem, right: PriceBoardItem) {
  const leftSoldOut = left.sale_status === "sold_out" ? 1 : 0;
  const rightSoldOut = right.sale_status === "sold_out" ? 1 : 0;
  if (leftSoldOut !== rightSoldOut) return leftSoldOut - rightSoldOut;

  const leftWeight = parseWeightRangeInKg(left.size_band)?.min ?? Number.MAX_SAFE_INTEGER;
  const rightWeight = parseWeightRangeInKg(right.size_band)?.min ?? Number.MAX_SAFE_INTEGER;
  if (leftWeight !== rightWeight) return leftWeight - rightWeight;

  return parseUnitPrice(left.unit_price) - parseUnitPrice(right.unit_price);
}

function getFishingStyleLabel(itemName: string) {
  if (itemName.includes("자연산")) return "자연산";
  if (itemName.includes("양식")) return "양식";
  return "";
}

function buildSelectedItem(boardItem: PriceBoardItem, quantity: number, cutType = "fillet"): SelectedOrderItem {
  return {
    id: makeItemId(),
    item_name: formatItemName(boardItem.item_name),
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
    item_name: formatItemName(itemName),
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
  if (type === "pickup") return board.order_guide.pickup_note;
  if (type === "quick") return board.order_guide.quick_note;
  return board.order_guide.parcel_note;
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function isValidPhoneNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("010")) return digits.length === 11;
  return digits.length >= 10 && digits.length <= 11;
}

export function CustomerOrderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const [options, setOptions] = useState<OrderFormOptions>(demoOrderOptions);
  const [form, setForm] = useState<OrderFormState>(initialForm);
  const [touched, setTouched] = useState<TouchedFields>({});
  const [items, setItems] = useState<SelectedOrderItem[]>([]);
  const [reservationItemName, setReservationItemName] = useState("");
  const [reservationItemSize, setReservationItemSize] = useState("");
  const [reservationItemDate, setReservationItemDate] = useState("");
  const [selectedSpecies, setSelectedSpecies] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [hasEditedDepositorName, setHasEditedDepositorName] = useState(false);
  const [highlightNextCta, setHighlightNextCta] = useState(false);
  const [fulfillmentConflict, setFulfillmentConflict] = useState<FulfillmentConflict | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const stepBodyRef = useRef<HTMLDivElement>(null);
  const selectedItemsRef = useRef<SelectedOrderItem[]>([]);

  const unitQuantity = form.purchase_unit === "half_request" ? 0.5 : 1;
  const cutTypes = options.cut_types.length ? options.cut_types : ["whole", "fillet", "sashimi"];
  const parcelSubtypes = options.parcel_subtypes.length ? options.parcel_subtypes : ["parcel_standard"];
  const fulfillmentTypes = options.fulfillment_types.length ? options.fulfillment_types : ["pickup", "quick", "parcel"];
  const isDelivery = form.fulfillment_type === "quick" || form.fulfillment_type === "parcel";
  const hasParcelSashimi = form.fulfillment_type === "parcel" && items.some((item) => item.requested_cut_type === "sashimi");
  const currentStepError = getStepError(currentStep);
  const speciesGroups = useMemo(() => {
    const groupMap = new Map<string, PriceBoardItem[]>();
    for (const item of board.items) {
      const key = getSpeciesLabel(item.item_name);
      const current = groupMap.get(key) ?? [];
      current.push(item);
      groupMap.set(key, current);
    }

    return Array.from(groupMap.entries()).map(([label, variants]) => ({
      label,
      variants: [...variants].sort(compareBoardItemVariants),
      inCartCount: variants.filter((variant) =>
        items.some((selectedItem) => selectedItem.item_name === formatItemName(variant.item_name))
      ).length
    }));
  }, [board.items, items]);
  const activeSpeciesGroup =
    speciesGroups.find((group) => group.label === selectedSpecies) ??
    speciesGroups[0] ??
    null;
  const selectedItemSummary = useMemo(() => {
    if (!items.length) return "원하는 품목을 고르면 여기서 바로 확인됩니다.";
    const labels = items.slice(0, 2).map((item) => formatItemName(item.item_name)).join(", ");
    return items.length > 2 ? `${labels} 외 ${items.length - 2}개` : labels;
  }, [items]);

  useEffect(() => {
    selectedItemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!speciesGroups.length) {
      setSelectedSpecies("");
      return;
    }

    if (!selectedSpecies || !speciesGroups.some((group) => group.label === selectedSpecies)) {
      setSelectedSpecies(speciesGroups[0].label);
    }
  }, [selectedSpecies, speciesGroups]);

  const estimates = useMemo(() => {
    const itemRange = items.reduce(
      (sum, item) => {
        const next = estimateItemTotal(item);
        if (!next) return sum;
        return { min: sum.min + next.min, max: sum.max + next.max };
      },
      { min: 0, max: 0 }
    );

    const processingFee = items.reduce((sum, item) => {
      const feePerUnit =
        item.requested_cut_type === "sashimi" ? 4000
        : item.requested_cut_type === "masukawa" || item.requested_cut_type === "sekkoshi" ? 5000
        : item.requested_cut_type === "fillet" ? 2000
        : 0;
      return sum + feePerUnit * item.quantity;
    }, 0);

    const deliveryRange =
      form.fulfillment_type === "pickup" ? { min: 0, max: 0 }
      : form.fulfillment_type === "quick" ? { min: 8000, max: 18000 }
      : form.fulfillment_subtype === "parcel_same_day" ? { min: 12000, max: 18000 }
      : { min: 7000, max: 10000 };

    return {
      itemRange,
      processingFee,
      deliveryRange,
      totalMin: itemRange.min + processingFee + deliveryRange.min,
      totalMax: itemRange.max + processingFee + deliveryRange.max
    };
  }, [form.fulfillment_subtype, form.fulfillment_type, items]);

  function syncSelectedItemsWithBoard(nextBoard: PriceBoardResponse) {
    const selectedItems = selectedItemsRef.current;
    if (!selectedItems.length) return;

    const boardItemMap = new Map(
      nextBoard.items.map((item) => [formatItemName(item.item_name), item])
    );
    const newlySoldOutNames = selectedItems
      .filter((item) => {
        const latest = boardItemMap.get(formatItemName(item.item_name));
        return latest?.sale_status === "sold_out" && item.sale_status !== "sold_out";
      })
      .map((item) => formatItemName(item.item_name));

    setItems((current) =>
      current.map((item) => {
        const latest = boardItemMap.get(formatItemName(item.item_name));
        if (!latest) return item;

        return {
          ...item,
          origin_label: latest.origin_label,
          size_band: latest.size_band,
          unit_price: latest.unit_price,
          unit_label: latest.unit_label,
          sale_status: latest.sale_status
        };
      })
    );

    if (newlySoldOutNames.length) {
      setSubmitMessage(
        `${newlySoldOutNames.join(", ")} 품목이 방금 품절로 바뀌었습니다. 해당 품목을 삭제하거나 예약 주문으로 문의해 주세요.`
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextStore, nextBoard, nextOptions] = await Promise.all([
          api.getStore(),
          api.getPriceBoard(),
          api.getOrderOptions()
        ]);
        if (cancelled) return;
        setStore(nextStore);
        setBoard(nextBoard);
        setOptions(nextOptions);
        syncSelectedItemsWithBoard(nextBoard);
        setForm((current) => ({
          ...current,
          fulfillment_type: current.fulfillment_type || nextOptions.fulfillment_types[0] || initialForm.fulfillment_type,
          fulfillment_subtype: current.fulfillment_subtype || nextOptions.parcel_subtypes[0] || initialForm.fulfillment_subtype
        }));
      } catch {
        if (cancelled) return;
        setStore(demoStore);
        setBoard(demoPriceBoard);
        setOptions(demoOrderOptions);
        syncSelectedItemsWithBoard(demoPriceBoard);
      }
    }
    void load();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void load();
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
    const restoreRecent = searchParams.get("restoreRecent");

    if (!halfRequested && !presetFlow && !presetItem && !restoreRecent) return;

    setForm((current) => ({
      ...current,
      order_flow: presetFlow === "reservation" ? "reservation" : current.order_flow,
      purchase_unit: halfRequested ? "half_request" : current.purchase_unit,
      requested_date:
        presetFlow === "reservation"
          ? getKoreaTomorrowDate()
          : current.requested_date
    }));

    if (presetItem) {
      setSelectedSpecies(getSpeciesLabel(presetItem));
      const boardItem = board.items.find(
        (item) => item.item_name === presetItem || formatItemName(item.item_name) === formatItemName(presetItem)
      );
      setItems([
        boardItem
          ? buildSelectedItem(boardItem, halfRequested ? 0.5 : 1)
          : buildCustomItem(presetItem, halfRequested ? 0.5 : 1)
      ]);
      setCurrentStep(1);
    }

    setSubmitMessage("품목을 담았습니다. 수령 방식, 손질, 연락처 순서로 확인해 주세요.");
    setSearchParams({}, { replace: true });
  }, [board.items, searchParams, setSearchParams]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const node = stepBodyRef.current;
      if (!node) return;

      const stickyOffset = window.innerWidth <= 640 ? 152 : 108;
      const nextTop = node.getBoundingClientRect().top + window.scrollY - stickyOffset;
      window.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [currentStep]);

  useEffect(() => {
    if (!window.visualViewport) return;

    const updateViewportInset = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset > 120 ? inset : 0);
    };

    updateViewportInset();
    window.visualViewport.addEventListener("resize", updateViewportInset);
    window.visualViewport.addEventListener("scroll", updateViewportInset);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportInset);
      window.visualViewport?.removeEventListener("scroll", updateViewportInset);
    };
  }, []);

  function updateField<K extends keyof OrderFormState>(key: K, value: OrderFormState[K]) {
    if (key === "fulfillment_type" && value === "parcel") {
      const conflicts = items
        .filter((item) => item.requested_cut_type === "sashimi")
        .map((item) => ({
          id: item.id,
          itemName: formatItemName(item.item_name),
          fromCut: cutTypeLabels[item.requested_cut_type] ?? formatStatusLabel(item.requested_cut_type),
          toCut: cutTypeLabels.fillet
        }));

      if (conflicts.length) {
        setTouched((prev) => ({ ...prev, [key]: true }));
        setFulfillmentConflict({ targetType: "parcel", conflicts });
        setSubmitMessage("");
        return;
      }
    }

    setTouched((prev) => ({ ...prev, [key]: true }));
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "order_flow") {
        next.requested_date = value === "reservation" ? getKoreaTomorrowDate() : getKoreaTodayDate();
      }
      if (key === "customer_name" && !hasEditedDepositorName) {
        next.depositor_name = String(value);
      }
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

    if (key === "fulfillment_type") {
      setFulfillmentConflict(null);
    }
    setSubmitMessage("");
  }

  function updatePhoneField(key: "customer_phone" | "receiver_phone", raw: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setForm((current) => ({ ...current, [key]: formatPhone(raw) }));
  }

  function updateDepositorField(value: string) {
    setHasEditedDepositorName(value.trim().length > 0 && value.trim() !== form.customer_name.trim());
    updateField("depositor_name", value);
  }

  function touchField(key: keyof OrderFormState) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function applyFulfillmentConflict() {
    if (!fulfillmentConflict) return;
    setForm((current) => ({
      ...current,
      fulfillment_type: fulfillmentConflict.targetType,
      fulfillment_subtype:
        fulfillmentConflict.targetType === "parcel" ? current.fulfillment_subtype || parcelSubtypes[0] : ""
    }));
    const conflictIds = new Set(fulfillmentConflict.conflicts.map((conflict) => conflict.id));
    setItems((current) =>
      current.map((item) => (
        conflictIds.has(item.id)
          ? { ...item, requested_cut_type: "fillet" }
          : item
      ))
    );
    setFulfillmentConflict(null);
    setSubmitMessage("");
    setCurrentStep(2);
  }

  function cancelFulfillmentConflict() {
    setFulfillmentConflict(null);
    setSubmitMessage("");
  }

  function toggleBoardItem(boardItem: PriceBoardItem) {
    const displayName = formatItemName(boardItem.item_name);

    if (boardItem.sale_status === "sold_out") {
      setSubmitMessage("품절 품목은 바로 주문할 수 없습니다. 예약 주문으로 문의해 주세요.");
      return;
    }

    const existing = items.find((item) => item.item_name === displayName);
    if (existing) {
      setItems((current) => current.filter((item) => item.id !== existing.id));
      setSubmitMessage(`${displayName} 품목을 담은 목록에서 뺐습니다.`);
      return;
    }

    const firstItem = items.length === 0;
    setItems((current) => [...current, buildSelectedItem(boardItem, unitQuantity)]);
    if (firstItem) {
      setHighlightNextCta(true);
      window.setTimeout(() => setHighlightNextCta(false), 1200);
    }
    setSubmitMessage("");
  }

  function addReservationItem() {
    const trimmedName = reservationItemName.trim();
    if (!trimmedName) {
      setSubmitMessage("예약 문의할 품목명을 입력해 주세요.");
      return;
    }
    const firstItem = items.length === 0;
    const serializedItemName = serializeReservationItemName(trimmedName, reservationItemSize, reservationItemDate);
    setItems((current) => [...current, buildCustomItem(serializedItemName, unitQuantity)]);
    setReservationItemName("");
    setReservationItemSize("");
    setReservationItemDate("");
    if (firstItem) {
      setHighlightNextCta(true);
      window.setTimeout(() => setHighlightNextCta(false), 1200);
    }
    setSubmitMessage("");
    setCurrentStep(1);
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  function clearAllItems() {
    if (!items.length) return;
    if (!window.confirm("담은 품목을 모두 비울까요?")) return;
    setItems([]);
    setSubmitMessage("");
  }

  function updateItem(itemId: string, updates: Partial<SelectedOrderItem>) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  }

  function getMinimumQuantity() {
    return form.purchase_unit === "half_request" ? 0.5 : 1;
  }

  function normalizeQuantity(quantity: number) {
    const minimum = getMinimumQuantity();
    if (!Number.isFinite(quantity)) return minimum;
    const rounded =
      form.purchase_unit === "half_request"
        ? Number((Math.round(quantity * 2) / 2).toFixed(1))
        : Math.round(quantity);
    return Math.max(minimum, rounded);
  }

  function adjustItemQuantity(itemId: string, delta: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, quantity: normalizeQuantity(item.quantity + delta) } : item
      )
    );
  }

  function handleCutChange(itemId: string, nextCutType: string) {
    if (form.fulfillment_type === "parcel" && nextCutType === "sashimi") {
      setSubmitMessage("택배는 회 손질을 선택할 수 없습니다. 필렛 또는 원물로 접수해 주세요.");
      return;
    }
    updateItem(itemId, { requested_cut_type: nextCutType });
    setSubmitMessage("");
  }

  function getStepError(stepIndex: number): string {
    if (stepIndex === 0 && !items.length) return "주문할 어종을 먼저 담아 주세요.";
    if (stepIndex === 1) {
      if (!form.fulfillment_type) return "수령 방식을 선택해 주세요.";
      if (form.fulfillment_type === "parcel" && !form.fulfillment_subtype) return "택배 종류를 선택해 주세요.";
      if (fulfillmentConflict) return "수령 방식 변경 안내를 먼저 확인해 주세요.";
    }
    if (stepIndex === 2) {
      if (!items.length) return "주문할 어종을 먼저 담아 주세요.";
      if (items.some((item) => item.sale_status === "sold_out"))
        return "품절로 바뀐 품목이 있습니다. 삭제하거나 예약 주문으로 문의해 주세요.";
      if (items.some((item) => item.quantity < 0.5)) return "반마리는 0.5, 한 마리는 1 기준으로 접수됩니다.";
      if (hasParcelSashimi) return "택배는 회 손질을 선택할 수 없습니다. 필렛 또는 원물로 변경해 주세요.";
    }
    if (stepIndex === 3) {
      if (!form.customer_name.trim() || !form.customer_phone.trim()) return "주문자 성함과 연락처를 입력해 주세요.";
      if (!isValidPhoneNumber(form.customer_phone)) return "주문자 연락처를 정확히 입력해 주세요. 010 휴대폰은 11자리여야 합니다.";
      if (!form.requested_date.trim() || !form.requested_time_slot.trim()) return "희망 날짜와 시간을 입력해 주세요.";
      if (isDelivery && (!form.receiver_name.trim() || !form.receiver_phone.trim()))
        return "퀵/택배는 수령인명과 수령인 연락처가 필요합니다.";
      if (isDelivery && !isValidPhoneNumber(form.receiver_phone))
        return "수령인 연락처를 정확히 입력해 주세요. 010 휴대폰은 11자리여야 합니다.";
      if (isDelivery && !form.address_line1.trim()) return "퀵/택배 수령 주소를 입력해 주세요.";
      if (form.fulfillment_type === "parcel" && !form.postal_code.trim()) return "택배 수령에는 우편번호가 필요합니다.";
    }
    if (stepIndex === 4) {
      const firstInvalid = findFirstInvalidStep();
      return firstInvalid === -1 ? "" : getStepError(firstInvalid);
    }
    return "";
  }

  function findFirstInvalidStep(): number {
    for (let index = 0; index < orderSteps.length - 1; index += 1) {
      if (getStepError(index)) return index;
    }
    return -1;
  }

  function handleNextStep() {
    const error = getStepError(currentStep);
    if (error) {
      setSubmitMessage(error);
      if (currentStep === 3) {
        setTouched({
          customer_name: true,
          customer_phone: true,
          requested_date: true,
          requested_time_slot: true,
          receiver_name: true,
          receiver_phone: true,
          address_line1: true,
          postal_code: true
        });
      }
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
        item_name: formatItemName(item.item_name),
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
    } catch (error) {
      if (isNetworkError(error)) {
        setSubmitMessage("인터넷 연결이 불안정합니다. 연결 후 다시 주문해 주세요.");
        return;
      }
      setSubmitMessage("지금은 미리보기 환경이라 예시 주문 확인 화면으로 이동합니다.");
      navigate(`/customer/status?token=${encodeURIComponent(demoOrderResult.public_token)}&submitted=1`);
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(field: keyof OrderFormState, message: string): string | null {
    return touched[field] && !form[field]?.toString().trim() ? message : null;
  }

  function phoneFieldError(field: "customer_phone" | "receiver_phone", emptyMessage: string): string | null {
    if (!touched[field]) return null;
    if (!form[field].trim()) return emptyMessage;
    if (!isValidPhoneNumber(form[field])) return "연락처를 정확히 입력해 주세요. 010 휴대폰은 11자리여야 합니다.";
    return null;
  }

  function renderSelectedCartPanel(options?: { compact?: boolean }) {
    if (!items.length) return null;

    const compact = options?.compact ?? false;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <div className={`selected-cart-panel${compact ? " compact" : ""}`} aria-label="담은 품목">
        <div className="selected-cart-head">
          <div>
            <strong>담은 품목</strong>
            <span>{items.length}종 · 총 {formatQuantityLabel(totalQuantity)}</span>
          </div>
          <button
            type="button"
            className="text-link danger"
            onClick={clearAllItems}
            aria-label="담은 품목 전체 비우기"
          >
            {compact ? "비우기" : "전체 비우기"}
          </button>
        </div>

        <div className="selected-cart-list">
          {items.map((item) => {
            const estimate = estimateItemTotal(item);
            const displayName = formatItemName(item.item_name);
            const compactName = [getSpeciesLabel(displayName), item.size_band].filter(Boolean).join(" · ");
            return (
              <article key={item.id} className={`selected-cart-item${compact ? " compact-row" : ""}`}>
                <div className={`selected-cart-main${compact ? " compact" : ""}`}>
                  {compact ? (
                    <div className="selected-cart-compact-summary" title={displayName}>
                      <strong>{compactName}</strong>
                      <span className="selected-cart-compact-quantity">{formatQuantityLabel(item.quantity)}</span>
                      <span className="selected-cart-compact-price">{formatCompactItemPrice(item)}</span>
                    </div>
                  ) : (
                    <>
                      <strong>{displayName}</strong>
                      <span>
                        {item.origin_label ?? "원산지 확인"} · {item.size_band ?? "크기 확인"}
                      </span>
                      <small>
                        {estimate ? `예상 ${formatPriceRange(estimate.min, estimate.max)}` : "금액 확인 후 안내"}
                      </small>
                    </>
                  )}
                </div>
                <div className={`selected-cart-actions${compact ? " compact" : ""}`}>
                  <div className="quantity-stepper" aria-label={`${displayName} 수량 조절`}>
                    <button
                      type="button"
                      onClick={() => adjustItemQuantity(item.id, -unitQuantity)}
                      disabled={item.quantity <= getMinimumQuantity()}
                      aria-label={`${displayName} 수량 줄이기`}
                    >
                      -
                    </button>
                    <strong>{compact ? formatCompactQuantityValue(item.quantity) : formatQuantityLabel(item.quantity)}</strong>
                    <button
                      type="button"
                      onClick={() => adjustItemQuantity(item.id, unitQuantity)}
                      aria-label={`${displayName} 수량 늘리기`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cart-remove-button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`${displayName} 삭제`}
                  >
                    {compact ? "×" : "삭제"}
                  </button>
                </div>
                {!compact && item.quantity >= 3 ? (
                  <small className="bulk-order-hint">대량 주문은 전화 문의를 권장합니다.</small>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  function renderStepBody() {
    // ─────────────────────────────────────────
    // STEP 0: 어종 선택
    // ─────────────────────────────────────────
    if (currentStep === 0) {
      return (
        <SectionCard
          title="1. 어종 선택"
          subtitle="오늘 시세에서 바로 담거나, 없는 품목은 예약 주문으로 남길 수 있습니다."
        >
          {/* ✅ 개선: 두 가지 결정을 별도 섹션으로 분리 */}
          <div className="order-choice-section">

            {/* 섹션 A: 주문 유형 */}
            <div className="order-choice-group">
              <p className="order-choice-label">주문 유형</p>
              <div className="order-choice-row">
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
                  <span>시세에 없는 품목도 요청 가능</span>
                </button>
              </div>
            </div>

            {/* 섹션 B: 구매 단위 */}
            <div className="order-choice-group">
              <p className="order-choice-label">구매 단위</p>
              <div className="order-choice-row">
                <button
                  type="button"
                  className={`simple-choice-card${form.purchase_unit === "whole" ? " active" : ""}`}
                  onClick={() => updateField("purchase_unit", "whole")}
                >
                  <strong>한 마리</strong>
                  <span>기본 1마리 단위로 접수</span>
                </button>
                <button
                  type="button"
                  className={`simple-choice-card${form.purchase_unit === "half_request" ? " active" : ""}`}
                  onClick={() => updateField("purchase_unit", "half_request")}
                >
                  <strong>반마리 문의</strong>
                  <span>반마리 매칭 가능 여부 확인 후 진행</span>
                </button>
              </div>
              {form.purchase_unit === "half_request" ? (
                <div className="order-warning-panel">
                  <strong>반마리 주문 안내</strong>
                  <p>반마리 매칭 여부는 보통 당일 오전 중 확인 후 안내드려요. 매칭이 어려우면 한 마리 전체 구매로 안내드릴 수 있습니다.</p>
                </div>
              ) : null}
            </div>

          </div>

          {/* 품목 선택 영역 */}
          {form.order_flow === "same_day" ? (
            <div className="order-stage-block">
              <div className="order-stage-note">
                <strong>
                  어종을 먼저 고른 뒤 규격을 선택해 주세요
                  {items.length > 0 && (
                    <span className="item-count-badge">{items.length}개 담김</span>
                  )}
                </strong>
                <span>
                  원하는 어종을 고르면 아래에 원산지와 크기별 규격이 정리됩니다. 다시 누르면 담은 목록에서 빠집니다.
                </span>
              </div>
              {speciesGroups.length ? (
                <>
                  <div className="species-selector">
                    <strong className="species-selector-title">어종 선택</strong>
                    <div className="species-chip-grid">
                      {speciesGroups.map((group) => (
                        <button
                          key={group.label}
                          type="button"
                          className={`species-chip${activeSpeciesGroup?.label === group.label ? " active" : ""}`}
                          onClick={() => setSelectedSpecies(group.label)}
                        >
                          <strong>{group.label}</strong>
                          <span>
                            {group.variants.length}개 규격
                            {group.inCartCount > 0 ? ` · ${group.inCartCount}개 담김` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeSpeciesGroup ? (
                    <>
                      <div className="order-stage-note compact">
                        <strong>{activeSpeciesGroup.label} 규격 선택</strong>
                        <span>
                          원산지와 크기별로 원하는 규격을 고르면 됩니다.
                          {form.purchase_unit === "half_request" ? " 반마리 기준으로 담깁니다." : " 담은 뒤에는 수량 단계에서 조절할 수 있습니다."}
                        </span>
                      </div>
                      <div className="market-item-grid">
                        {activeSpeciesGroup.variants.map((item) => {
                          const displayName = formatItemName(item.item_name);
                          const displayNote = formatItemNote(item.note);
                          const inCart = items.find((selectedItem) => selectedItem.item_name === displayName);
                          const fishingStyle = getFishingStyleLabel(item.item_name);
                          return (
                            <button
                              key={item.id ?? item.item_name}
                              type="button"
                              className={`market-item-card market-item-card.variant${item.sale_status === "sold_out" ? " disabled" : ""}${inCart ? " in-cart" : ""}`}
                              onClick={() => toggleBoardItem(item)}
                              aria-pressed={Boolean(inCart)}
                              aria-disabled={item.sale_status === "sold_out"}
                            >
                              <span className="market-item-top">
                                <strong>{item.size_band ?? displayName}</strong>
                                <StatusBadge value={item.sale_status} />
                              </span>
                              <span>
                                {[fishingStyle, item.origin_label, displayName !== activeSpeciesGroup.label ? displayName : ""]
                                  .filter(Boolean)
                                  .join(" · ") || "원산지와 규격 확인"}
                              </span>
                              <b>{formatUnitPriceLabel(item.unit_price, item.unit_label)}</b>
                              {item.reservable_flag && item.sale_status === "reserved_only" && item.reservation_cutoff_note ? (
                                <small className="reservation-hint">📋 {item.reservation_cutoff_note}</small>
                              ) : item.sale_status === "sold_out" ? (
                                <small className="sold-out-hint">품절 · 예약 주문으로 문의해 주세요</small>
                              ) : displayNote ? (
                                <small>{displayNote}</small>
                              ) : null}
                              {inCart ? (
                                <span className="in-cart-indicator">{formatQuantityLabel(inCart.quantity)} 담김 · 다시 누르면 해제</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="empty-board-state">
                  <p>오늘 시세를 준비 중입니다.</p>
                  <p>예약 주문으로 문의하거나 잠시 후 다시 확인해 주세요.</p>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    onClick={() => updateField("order_flow", "reservation")}
                  >
                    예약 주문으로 전환
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="order-stage-block">
              <div className="order-stage-note">
                <strong>찾는 품목 직접 입력</strong>
                <span>시세에 없는 품목도 필요한 정보를 나눠 남기면 운영자가 더 빠르게 확인할 수 있습니다.</span>
              </div>
              <div className="reservation-structured-grid">
                <label className="field-block">
                  <span>찾는 품목</span>
                  <input
                    value={reservationItemName}
                    onChange={(event) => setReservationItemName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addReservationItem();
                      }
                    }}
                    placeholder="예: 연어 반마리, 돌돔 2kg급"
                    autoFocus
                  />
                </label>
                <label className="field-block">
                  <span>희망 크기</span>
                  <input
                    value={reservationItemSize}
                    onChange={(event) => setReservationItemSize(event.target.value)}
                    placeholder="예: 2kg급 (선택)"
                  />
                </label>
                <label className="field-block">
                  <span>원하는 날짜</span>
                  <input
                    type="date"
                    value={reservationItemDate}
                    onChange={(event) => setReservationItemDate(event.target.value)}
                    min={getKoreaTomorrowDate()}
                  />
                </label>
                <button type="button" className="primary-button reservation-add-button" onClick={addReservationItem}>
                  + 담기
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      );
    }

    // ─────────────────────────────────────────
    // STEP 2: 손질/수량
    // ─────────────────────────────────────────
    if (currentStep === 2) {
      return (
        <SectionCard title="3. 손질/수량" subtitle="반마리는 0.5, 한 마리는 1 기준입니다. 모르면 필렛을 선택하세요.">
          {/* ✅ 개선: 택배+회손질 조합 경고를 카드 상단에 명확히 표시 */}
          {hasParcelSashimi ? (
            <div className="order-warning-panel" role="alert">
              <strong>택배는 회 손질을 선택할 수 없습니다</strong>
              <p>이동 시간이 있어 품질 유지가 어렵습니다. 회 손질 대신 필렛 또는 원물로 변경해 주세요.</p>
            </div>
          ) : null}

          <div className="selected-order-list">
            {items.length ? (
              items.map((item) => {
                const estimate = estimateItemTotal(item);
                const displayName = formatItemName(item.item_name);
                return (
                  <article key={item.id} className="selected-order-card">
                    <div>
                      <strong>{displayName}</strong>
                      <p>
                        {item.origin_label ?? "원산지 확인"} · {item.size_band ?? "크기 확인"}
                      </p>
                      {estimate ? (
                        <span className="item-estimate-badge">
                          예상 {formatPriceRange(estimate.min, estimate.max)}
                        </span>
                      ) : (
                        <span className="item-estimate-badge muted">금액 확인 후 안내</span>
                      )}
                    </div>
                    <div className="selected-order-controls">
                      <div className="selected-order-control-group">
                        <span>수량</span>
                        <div className="quantity-stepper" aria-label={`${displayName} 수량 조절`}>
                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item.id, -unitQuantity)}
                            disabled={item.quantity <= getMinimumQuantity()}
                            aria-label={`${displayName} 수량 줄이기`}
                          >
                            -
                          </button>
                          <strong>{formatQuantityLabel(item.quantity)}</strong>
                          <button
                            type="button"
                            onClick={() => adjustItemQuantity(item.id, unitQuantity)}
                            aria-label={`${displayName} 수량 늘리기`}
                          >
                            +
                          </button>
                        </div>
                        {item.quantity >= 3 ? (
                          <small className="bulk-order-hint">대량 주문은 전화 문의를 권장합니다.</small>
                        ) : null}
                      </div>
                      <div className="selected-order-control-group wide">
                        <span>손질</span>
                        <div className="cut-card-grid" role="radiogroup" aria-label={`${displayName} 손질 방법`}>
                          {cutTypes.map((cutType) => {
                            const disabled = form.fulfillment_type === "parcel" && cutType === "sashimi";
                            const active = item.requested_cut_type === cutType;
                            return (
                              <button
                                key={cutType}
                                type="button"
                                className={`cut-option-card${active ? " active" : ""}`}
                                onClick={() => handleCutChange(item.id, cutType)}
                                disabled={disabled}
                                role="radio"
                                aria-checked={active}
                              >
                                <strong>
                                  {cutTypeLabels[cutType] ?? formatStatusLabel(cutType)}
                                  {cutType === "fillet" ? <span>추천</span> : null}
                                </strong>
                                <small>
                                  {disabled ? "택배 선택 시 불가" : cutTypeDescriptions[cutType] ?? "주문 내용 확인 후 안내"}
                                </small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-danger-button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`${displayName} 삭제`}
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-order-card">
                <p>아직 담은 품목이 없습니다.</p>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => setCurrentStep(0)}
                >
                  ← 어종 선택으로 돌아가기
                </button>
              </div>
            )}
          </div>

          <div className="order-warning-panel">
            <strong>손질 선택 기준</strong>
            <p>모르면 필렛을 선택하세요. 바로 드실 예정이면 회 손질, 이동이나 보관이 있으면 필렛을 권장합니다. 택배는 필렛 또는 원물로 접수해 주세요.</p>
          </div>
        </SectionCard>
      );
    }

    // ─────────────────────────────────────────
    // STEP 1: 수령 방식
    // ─────────────────────────────────────────
    if (currentStep === 1) {
      return (
        <SectionCard title="2. 수령 방식" subtitle="받는 방식에 따라 가능한 손질과 마감 시간이 달라집니다.">
          <div className="fulfillment-choice-grid">
            {fulfillmentTypes.map((type) => {
              const detail = fulfillmentChoiceDetails[type] ?? { cost: "확인 후 안내", timing: fulfillmentCopy(type, board) };
              return (
                <button
                  key={type}
                  type="button"
                  className={`simple-choice-card fulfillment-card${form.fulfillment_type === type ? " active" : ""}`}
                  onClick={() => updateField("fulfillment_type", type)}
                >
                  <strong>
                    {type === "pickup" ? "매장 픽업" : type === "quick" ? "퀵" : "택배"}
                  </strong>
                  <b>{detail.cost}</b>
                  <span>{detail.timing}</span>
                </button>
              );
            })}
          </div>

          {fulfillmentConflict ? (
            <div className="order-warning-panel fulfillment-conflict-panel" role="alert">
              <strong>택배로 변경하면 아래 품목의 손질이 바뀝니다</strong>
              <ul>
                {fulfillmentConflict.conflicts.map((conflict) => (
                  <li key={conflict.id}>
                    {conflict.itemName} — {conflict.fromCut} → {conflict.toCut}으로 변경됩니다
                  </li>
                ))}
              </ul>
              <div className="button-row">
                <button type="button" className="primary-button compact-button" onClick={applyFulfillmentConflict}>
                  계속 진행
                </button>
                <button type="button" className="secondary-button compact-button" onClick={cancelFulfillmentConflict}>
                  수령방식 다시 선택
                </button>
              </div>
            </div>
          ) : null}

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

          {/* ✅ 개선: 퀵/픽업은 회 손질 OK 안내 */}
          {(form.fulfillment_type === "pickup" || form.fulfillment_type === "quick") && hasParcelSashimi ? (
            <div className="notice-panel">
              <strong>✓ 이 수령 방법은 회 손질이 가능합니다.</strong>
              <p>이미 회 손질로 선택된 품목이 있습니다. 이대로 진행하셔도 됩니다.</p>
            </div>
          ) : null}
        </SectionCard>
      );
    }

    // ─────────────────────────────────────────
    // STEP 3: 연락처/수령 정보
    // ─────────────────────────────────────────
    if (currentStep === 3) {
      return (
          <SectionCard title="4. 연락처/수령 정보" subtitle="금액 안내와 수령에 필요한 정보를 정확히 입력해 주세요.">
          <div className="form-grid two">
            <label className={`field-block${touched.customer_name && !form.customer_name.trim() ? " has-error" : ""}`}>
              <span>주문자 성함 <span className="required-mark">*</span></span>
              <input
                value={form.customer_name}
                onChange={(event) => updateField("customer_name", event.target.value)}
                onBlur={() => touchField("customer_name")}
                placeholder="홍길동"
                autoComplete="name"
                aria-required="true"
              />
              {fieldError("customer_name", "성함을 입력해 주세요.") ? (
                <span className="field-error" role="alert">{fieldError("customer_name", "성함을 입력해 주세요.")}</span>
              ) : null}
            </label>
            <label className="field-block">
              <span>입금자명</span>
              <input
                value={form.depositor_name}
                onChange={(event) => updateDepositorField(event.target.value)}
                placeholder="주문자명과 다를 경우에만 입력"
                autoComplete="name"
              />
              <span className="field-hint">예: 배우자나 가족이 대신 입금하는 경우</span>
            </label>
          </div>

          <div className="form-grid two">
            <label className={`field-block${phoneFieldError("customer_phone", "연락처를 입력해 주세요.") ? " has-error" : ""}`}>
              <span>주문자 연락처 <span className="required-mark">*</span></span>
              <input
                value={form.customer_phone}
                onChange={(event) => updatePhoneField("customer_phone", event.target.value)}
                onBlur={() => touchField("customer_phone")}
                placeholder="010-0000-0000"
                inputMode="tel"
                autoComplete="tel"
                aria-required="true"
              />
              {phoneFieldError("customer_phone", "연락처를 입력해 주세요.") ? (
                <span className="field-error" role="alert">{phoneFieldError("customer_phone", "연락처를 입력해 주세요.")}</span>
              ) : null}
            </label>
            <label className={`field-block${touched.requested_date && !form.requested_date.trim() ? " has-error" : ""}`}>
              <span>희망 날짜 <span className="required-mark">*</span></span>
              <input
                type="date"
                value={form.requested_date}
                onChange={(event) => updateField("requested_date", event.target.value)}
                onBlur={() => touchField("requested_date")}
                min={form.order_flow === "reservation" ? getKoreaTomorrowDate() : getKoreaTodayDate()}
                aria-required="true"
              />
            </label>
          </div>

          <div className={`field-block${touched.requested_time_slot && !form.requested_time_slot.trim() ? " has-error" : ""}`}>
            <span>희망 시간 <span className="required-mark">*</span></span>
            <div className="time-slot-grid" role="group" aria-label="희망 시간 선택">
              {timeSlotOptions.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  className={`time-slot-button${form.requested_time_slot === slot.value ? " active" : ""}`}
                  onClick={() => updateField("requested_time_slot", slot.value)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <input
              value={form.requested_time_slot}
              onChange={(event) => updateField("requested_time_slot", event.target.value)}
              onBlur={() => touchField("requested_time_slot")}
              placeholder="직접 입력: 예: 오후 3시 30분 전후"
              aria-required="true"
            />
            <span className="field-hint">정확한 시간이 아니어도 괜찮습니다. 가능한 시간대를 선택해 주세요.</span>
            {fieldError("requested_time_slot", "희망 시간을 입력해 주세요.") ? (
              <span className="field-error" role="alert">{fieldError("requested_time_slot", "희망 시간을 입력해 주세요.")}</span>
            ) : null}
          </div>

          {isDelivery ? (
            <div className="delivery-fields">
              <div className="form-grid two">
                <label className={`field-block${touched.receiver_name && !form.receiver_name.trim() ? " has-error" : ""}`}>
                  <span>수령인명 <span className="required-mark">*</span></span>
                  <input
                    value={form.receiver_name}
                    onChange={(event) => updateField("receiver_name", event.target.value)}
                    onBlur={() => touchField("receiver_name")}
                    placeholder="수령인 이름"
                    autoComplete="name"
                  />
                  {fieldError("receiver_name", "수령인명을 입력해 주세요.") ? (
                    <span className="field-error" role="alert">{fieldError("receiver_name", "수령인명을 입력해 주세요.")}</span>
                  ) : null}
                </label>
                <label className={`field-block${phoneFieldError("receiver_phone", "수령인 연락처를 입력해 주세요.") ? " has-error" : ""}`}>
                  <span>수령인 연락처 <span className="required-mark">*</span></span>
                  <input
                    value={form.receiver_phone}
                    onChange={(event) => updatePhoneField("receiver_phone", event.target.value)}
                    onBlur={() => touchField("receiver_phone")}
                    placeholder="010-0000-0000"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  {phoneFieldError("receiver_phone", "수령인 연락처를 입력해 주세요.") ? (
                    <span className="field-error" role="alert">{phoneFieldError("receiver_phone", "수령인 연락처를 입력해 주세요.")}</span>
                  ) : null}
                </label>
              </div>
              {form.fulfillment_type === "parcel" ? (
                <label className={`field-block compact${touched.postal_code && !form.postal_code.trim() ? " has-error" : ""}`}>
                  <span>우편번호 <span className="required-mark">*</span></span>
                  <input
                    value={form.postal_code}
                    onChange={(event) => updateField("postal_code", event.target.value)}
                    onBlur={() => touchField("postal_code")}
                    inputMode="numeric"
                    placeholder="12345"
                    maxLength={5}
                    autoComplete="postal-code"
                  />
                  {fieldError("postal_code", "우편번호를 입력해 주세요.") ? (
                    <span className="field-error" role="alert">{fieldError("postal_code", "우편번호를 입력해 주세요.")}</span>
                  ) : null}
                </label>
              ) : null}
              <label className={`field-block${touched.address_line1 && !form.address_line1.trim() ? " has-error" : ""}`}>
                <span>{form.fulfillment_type === "quick" ? "퀵 받을 주소" : "택배 기본 주소"} <span className="required-mark">*</span></span>
                <input
                  value={form.address_line1}
                  onChange={(event) => updateField("address_line1", event.target.value)}
                  onBlur={() => touchField("address_line1")}
                  placeholder="도로명 주소"
                  autoComplete="street-address"
                />
                {fieldError("address_line1", "주소를 입력해 주세요.") ? (
                  <span className="field-error" role="alert">{fieldError("address_line1", "주소를 입력해 주세요.")}</span>
                ) : null}
              </label>
              <label className="field-block">
                <span>상세 주소</span>
                <input
                  value={form.address_line2}
                  onChange={(event) => updateField("address_line2", event.target.value)}
                  placeholder="동/호수 등 (선택)"
                  autoComplete="address-line2"
                />
              </label>
            </div>
          ) : null}

          <label className="field-block">
            <span>요청사항</span>
            <textarea
              value={form.customer_request}
              onChange={(event) => updateField("customer_request", event.target.value)}
              placeholder="예: 뼈도 함께 포장해 주세요. 4시 전 수령을 희망합니다."
            />
          </label>

        </SectionCard>
      );
    }

    // ─────────────────────────────────────────
    // STEP 4: 최종 확인
    // ─────────────────────────────────────────
    return (
      <SectionCard title="5. 최종 확인" subtitle="최종 금액은 실제 중량과 손질 조건 확인 후 다시 안내됩니다.">
        <div className="order-review-grid">
          <article className="order-review-card">
            <span>주문 품목</span>
            <strong>{items.length}개 품목</strong>
            <p>{items.map((item) => `${formatItemName(item.item_name)} ${item.quantity}`).join(", ") || "품목 없음"}</p>
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
            <strong>{form.customer_name || "미입력"}</strong>
            <p>{form.customer_phone || "연락처 없음"}</p>
          </article>
          <article className="order-review-card">
            <span>희망 일정</span>
            <strong>{form.requested_date}</strong>
            <p>{form.requested_time_slot || "시간 미지정"}</p>
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
            <span>예상 총액</span>
          <strong>{estimates.itemRange.max > 0 ? formatPriceRange(estimates.totalMin, estimates.totalMax) : "품목 확인 후 안내"}</strong>
          <p>중량대 기준 추정 금액입니다. 실제 중량 확인 후 최종 금액을 다시 안내합니다.</p>
        </div>

        {/* ✅ 개선: 제출 전 최종 알림 안내 */}
        <div className="notice-panel">
          <strong>접수 후 10~20분 안에 금액을 안내합니다</strong>
          <p>품목 상태와 손질 조건을 확인한 뒤 정확한 금액을 문자나 카톡으로 안내합니다. 입금은 금액 확인 후 진행해 주세요.</p>
        </div>
      </SectionCard>
    );
  }

  const nextButtonLabel =
    currentStep === 0 && items.length > 0 ? "수령 방식 선택하기 →" : "다음";
  const hasStickyCart = items.length > 0 && currentStep <= 1;
  const stickyBottomOffset =
    currentStep === 3 && keyboardInset > 0 && window.innerWidth <= 640
      ? `${keyboardInset + 12}px`
      : undefined;

  return (
    <form
      className={`page-content order-simple-page order-conversion-page${hasStickyCart ? " has-sticky-cart" : ""}`}
      onSubmit={handleSubmit}
      noValidate
    >
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문하기</p>
          <h1 className="page-title">시세에서 고르고, 주문번호까지 바로 확인하세요</h1>
          <p className="page-description">
            어종, 받는 방법, 손질만 순서대로 고르면 예상 금액과 함께 주문서가 완성됩니다.
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
            aria-current={index === currentStep ? "step" : undefined}
            aria-label={`${index + 1}단계: ${step.title}${index < currentStep ? " (완료)" : ""}`}
          >
            <span className="order-step-index">
              {index < currentStep ? "✓" : index + 1}
            </span>
            <span className="order-step-label">{step.title}</span>
            {index === 0 && items.length > 0 ? (
              <span className="step-count-dot" aria-label={`${items.length}개 담김`}>{items.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div ref={stepBodyRef}>
        {renderStepBody()}
      </div>

      {submitMessage ? (
        <div className="notice-panel" role="alert" aria-live="assertive">
          {submitMessage}
        </div>
      ) : null}

      <div
        className={`order-sticky-cta${highlightNextCta ? " pulse" : ""}${stickyBottomOffset ? " keyboard-open" : ""}`}
        aria-live="polite"
        style={stickyBottomOffset ? { bottom: stickyBottomOffset } : undefined}
      >
        <div className="order-sticky-copy">
          <span>
            {items.length}개 품목 · {orderSteps[currentStep].title}
          </span>
          {items.length && !hasStickyCart ? <p className="order-sticky-items">{selectedItemSummary}</p> : null}
          <strong>
            {estimates.itemRange.max > 0 ? formatPriceRange(estimates.totalMin, estimates.totalMax) : "예상 금액 대기"}
          </strong>
          <small className={currentStepError ? "text-error" : ""}>
            {currentStepError || (estimates.itemRange.max > 0 ? "중량대 기준 추정 · 실제 중량 확인 후 안내" : orderSteps[currentStep].description)}
          </small>
        </div>
        {hasStickyCart ? renderSelectedCartPanel({ compact: true }) : null}
        <div className="order-sticky-actions">
          {currentStep > 0 ? (
            <button type="button" className="secondary-button compact-button" onClick={handlePreviousStep}>
              이전
            </button>
          ) : null}
          {currentStep < orderSteps.length - 1 ? (
            <button type="button" className="primary-button compact-button" onClick={handleNextStep}>
              {nextButtonLabel}
            </button>
          ) : (
            <button type="submit" className="primary-button compact-button" disabled={submitting}>
              {submitting ? "접수 중..." : "주문 접수"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
