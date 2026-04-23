import { saleStatuses } from "../../domain/reference-data";
import { notFoundError, validationError } from "../../lib/errors";
import { listProcessingRules, type ProcessingRuleRecord } from "../processing-rules/processing-rules.repository";
import { getDefaultStore } from "../stores/stores.service";
import {
  createPriceBoardItem,
  getLatestPublishedPriceBoard,
  getPriceBoardItems,
  getPublishedPriceBoardByDate,
  listPriceBoardBatches,
  publishPriceBoardBatch,
  updatePriceBoardItem,
  upsertPriceBoardBatch
} from "./price-board.repository";

const fallbackPriceBoardItems = [
  {
    id: "fallback_pb_1",
    item_name: "자연산 광어",
    origin_label: "국산",
    size_band: "3~5kg",
    unit_price: "22000",
    unit_label: "kg",
    sale_status: "available",
    reservable_flag: true,
    reservation_cutoff_note: "반마리 주문 가능 / 상태 확인 후 안내",
    note: "데모 시세 · kg당 단가"
  },
  {
    id: "fallback_pb_2",
    item_name: "자연산 도다리",
    origin_label: "국산",
    size_band: "1~1.5kg",
    unit_price: "20000",
    unit_label: "kg",
    sale_status: "available",
    reservable_flag: true,
    reservation_cutoff_note: "당일 문의 가능",
    note: "데모 시세 · kg당 단가"
  },
  {
    id: "fallback_pb_3",
    item_name: "참돔",
    origin_label: "일본산",
    size_band: "2.5~3kg",
    unit_price: "25000",
    unit_label: "kg",
    sale_status: "available",
    reservable_flag: true,
    reservation_cutoff_note: "껍질 작업은 확인 후 안내",
    note: "데모 시세 · kg당 단가"
  },
  {
    id: "fallback_pb_4",
    item_name: "농어",
    origin_label: "중국산",
    size_band: "3~3.5kg",
    unit_price: "23000",
    unit_label: "kg",
    sale_status: "available",
    reservable_flag: true,
    reservation_cutoff_note: "당일 문의 가능",
    note: "데모 시세 · kg당 단가"
  },
  {
    id: "fallback_pb_5",
    item_name: "연어",
    origin_label: "노르웨이",
    size_band: "6~8kg",
    unit_price: "23000",
    unit_label: "kg",
    sale_status: "reserved_only",
    reservable_flag: true,
    reservation_cutoff_note: "전날 예약 / 반마리 매칭 가능 여부 확인",
    note: "데모 시세 · 예약 문의"
  }
];

const fallbackProcessingRulesSummary = [
  "포 뜨기 kg당 2,000원",
  "회 작업 kg당 4,000원",
  "껍질 작업 kg당 5,000원",
  "진공포장은 포 뜨기 기준 가능 여부 확인"
];

const processingCutTypeLabels: Record<string, string> = {
  raw: "원물 그대로",
  whole: "원물 그대로",
  round: "원물 그대로",
  fillet: "포 뜨기",
  sashimi: "회 작업",
  masukawa: "마스까와",
  sekkoshi: "세꼬시",
  steak: "토막 손질"
};

function formatFeeAmount(value: string | null) {
  if (!value) {
    return "개별 문의";
  }

  const amount = Number(value);
  if (Number.isFinite(amount)) {
    return `${amount.toLocaleString("ko-KR")}원`;
  }

  return `${value}원`;
}

function formatProcessingRuleSummary(rule: ProcessingRuleRecord) {
  const speciesLabel = rule.species_name === "공통" ? "" : `${rule.species_name} `;
  const cutTypeLabel = processingCutTypeLabels[rule.cut_type] ?? rule.cut_type;
  const feeLabel = rule.fee_amount ? `${rule.fee_mode} ${formatFeeAmount(rule.fee_amount)}` : "개별 문의";

  return `${speciesLabel}${cutTypeLabel}: ${feeLabel}`.trim();
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown, fieldName: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw validationError("숫자 형식이 올바르지 않습니다.", {
      [fieldName]: "숫자 값을 입력해주세요."
    });
  }
  return value;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function validateSaleStatus(value: unknown): string {
  const status = asString(value);
  if (!status || !saleStatuses.includes(status as (typeof saleStatuses)[number])) {
    throw validationError("판매 상태가 올바르지 않습니다.", {
      sale_status: "available, reserved_only, sold_out 중 하나를 선택해주세요."
    });
  }
  return status;
}

function normalizeDate(value: unknown, fieldName: string): string {
  const date = asString(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw validationError("날짜 형식이 올바르지 않습니다.", {
      [fieldName]: "YYYY-MM-DD 형식으로 입력해주세요."
    });
  }
  return date;
}

export async function getAdminPriceBoards(date?: string) {
  const store = await getDefaultStore();
  const batches = await listPriceBoardBatches(store.id, date);
  const firstBatch = batches[0];
  const items = firstBatch ? await getPriceBoardItems(firstBatch.id) : [];

  return {
    date: date ?? null,
    boards: batches,
    items
  };
}

export async function getTodayPriceBoard(date?: string) {
  const store = await getDefaultStore();
  const targetDate =
    date ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul"
    }).format(new Date());
  const batch =
    (await getPublishedPriceBoardByDate(store.id, targetDate)) ??
    (date ? null : await getLatestPublishedPriceBoard(store.id));
  const dbItems = batch ? await getPriceBoardItems(batch.id) : [];
  const items = dbItems.length ? dbItems : fallbackPriceBoardItems;
  const rules = await listProcessingRules(store.id);
  const processingRulesSummary = rules
    .filter((rule) => rule.is_active)
    .map(formatProcessingRuleSummary);

  return {
    board_date: batch?.board_date ?? targetDate,
    items,
    order_guide: {
      pickup_note: "방문 예정 시간만 남겨주시면 포장비 없이 순서에 맞춰 준비해드려요.",
      quick_note: "당일 드실 분은 퀵이 가장 안정적이고, 최소 2~3시간 전 주문이 좋아요.",
      parcel_note: "당일택배는 오전 9시 30분 전 문자 주문, 일반택배는 포 뜨기·오로시 위주로 권장합니다.",
      processing_rules_summary: processingRulesSummary.length
        ? processingRulesSummary
        : fallbackProcessingRulesSummary,
      cutoff_windows: [
        {
          fulfillment_type: "pickup",
          label: "매장 픽업",
          cutoff_note: "방문 예정 시간만 먼저 남겨주시면 순서에 맞춰 준비해드려요."
        },
        {
          fulfillment_type: "quick",
          label: "퀵 수령",
          cutoff_note: "서울·경기권 당일 식사는 퀵이 가장 안정적이고, 최소 2~3시간 전 주문이 좋아요."
        },
        {
          fulfillment_type: "parcel",
          label: "택배 수령",
          cutoff_note: "당일택배는 오전 9시 30분 전 주문 권장, 일반택배는 포 뜨기·오로시 위주로 안내합니다."
        }
      ],
      expected_price_note:
        "시세표는 kg당 기준이라 중량대에 따라 예상 원물가 범위를 먼저 보여드리고, 최종 금액은 다시 정확히 안내해드려요.",
      reservation_deposit_policy:
        "연어와 일부 고가 어종은 전날 예약이 필요하고, 예약 진행 시 가능 여부와 예약금 여부를 먼저 안내해드려요."
    }
  };
}

export async function createOrUpdatePriceBoard(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }

  const data = payload as Record<string, unknown>;
  const boardDate = normalizeDate(data.board_date, "board_date");
  const title = asString(data.title) ?? null;
  const store = await getDefaultStore();

  return upsertPriceBoardBatch(store.id, boardDate, title);
}

export async function addPriceBoardItem(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }

  const data = payload as Record<string, unknown>;
  const batchId = asString(data.batch_id);
  const itemName = asString(data.item_name);
  if (!batchId || !itemName) {
    throw validationError("필수 항목이 누락되었습니다.", {
      batch_id: batchId ? "" : "시세판 배치를 선택해주세요.",
      item_name: itemName ? "" : "품목명을 입력해주세요."
    });
  }

  return createPriceBoardItem({
    batchId,
    itemName,
    originLabel: asString(data.origin_label) ?? null,
    sizeBand: asString(data.size_band) ?? null,
    unitPrice: asNumber(data.unit_price, "unit_price"),
    unitLabel: asString(data.unit_label) ?? "kg",
    saleStatus: validateSaleStatus(data.sale_status),
    reservableFlag: asBoolean(data.reservable_flag) ?? false,
    reservationCutoffNote: asString(data.reservation_cutoff_note) ?? null,
    note: asString(data.note) ?? null,
    sortOrder: asNumber(data.sort_order, "sort_order") ?? 100
  });
}

export async function patchPriceBoardItem(itemId: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }

  const data = payload as Record<string, unknown>;
  const updated = await updatePriceBoardItem(itemId, {
    itemName: asString(data.item_name),
    originLabel: data.origin_label === null ? null : asString(data.origin_label),
    sizeBand: data.size_band === null ? null : asString(data.size_band),
    unitPrice: asNumber(data.unit_price, "unit_price"),
    unitLabel: asString(data.unit_label),
    saleStatus: data.sale_status === undefined ? undefined : validateSaleStatus(data.sale_status),
    reservableFlag: asBoolean(data.reservable_flag),
    reservationCutoffNote:
      data.reservation_cutoff_note === null ? null : asString(data.reservation_cutoff_note),
    note: data.note === null ? null : asString(data.note),
    sortOrder: asNumber(data.sort_order, "sort_order") ?? undefined
  });

  if (!updated) {
    throw notFoundError("PRICE_BOARD_ITEM_NOT_FOUND", "시세 품목을 찾을 수 없습니다.");
  }

  return updated;
}

export async function publishPriceBoard(batchId: string) {
  const published = await publishPriceBoardBatch(batchId);
  if (!published) {
    throw notFoundError("PRICE_BOARD_NOT_FOUND", "시세판을 찾을 수 없습니다.");
  }
  return published;
}
