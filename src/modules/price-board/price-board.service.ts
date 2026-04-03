import { saleStatuses } from "../../domain/reference-data";
import { notFoundError, validationError } from "../../lib/errors";
import { listProcessingRules } from "../processing-rules/processing-rules.repository";
import { getDefaultStore } from "../stores/stores.service";
import {
  createPriceBoardItem,
  getPriceBoardItems,
  getPublishedPriceBoardByDate,
  listPriceBoardBatches,
  publishPriceBoardBatch,
  updatePriceBoardItem,
  upsertPriceBoardBatch
} from "./price-board.repository";

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
  const batch = await getPublishedPriceBoardByDate(store.id, targetDate);
  const items = batch ? await getPriceBoardItems(batch.id) : [];
  const rules = await listProcessingRules(store.id);

  return {
    board_date: targetDate,
    items,
    order_guide: {
      pickup_note: "직접 픽업은 방문 예정 시간 입력이 필요합니다.",
      quick_note: "카카오퀵은 픽업 2~3시간 전 주문이 권장됩니다.",
      parcel_note: "일반택배는 오로시/필렛 위주 권장, 회는 퀵 권장입니다.",
      processing_rules_summary: rules
        .filter((rule) => rule.is_active)
        .map((rule) => {
          const fee = rule.fee_amount ? ` ${rule.fee_amount}원` : "";
          return `${rule.species_name} ${rule.cut_type} ${rule.fee_mode}${fee}`.trim();
        })
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
