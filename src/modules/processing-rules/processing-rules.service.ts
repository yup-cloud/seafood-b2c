import { notFoundError, validationError } from "../../lib/errors";
import { getDefaultStore } from "../stores/stores.service";
import {
  createProcessingRule,
  listProcessingRules,
  updateProcessingRule,
  UpdateProcessingRuleInput
} from "./processing-rules.repository";

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === "") {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw validationError("금액은 숫자여야 합니다.", {
      fee_amount: "손질비는 숫자로 입력해주세요."
    });
  }
  return value;
}

export async function getProcessingRules() {
  const store = await getDefaultStore();
  return listProcessingRules(store.id);
}

export async function createProcessingRuleFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }

  const store = await getDefaultStore();
  const data = payload as Record<string, unknown>;
  const speciesName = asString(data.species_name);
  const cutType = asString(data.cut_type);
  const feeMode = asString(data.fee_mode);

  if (!speciesName || !cutType || !feeMode) {
    throw validationError("필수 항목이 누락되었습니다.", {
      species_name: speciesName ? "" : "어종명을 입력해주세요.",
      cut_type: cutType ? "" : "손질 유형을 입력해주세요.",
      fee_mode: feeMode ? "" : "수수료 방식을 입력해주세요."
    });
  }

  return createProcessingRule({
    storeId: store.id,
    speciesName,
    cutType,
    feeMode,
    feeAmount: asNullableNumber(data.fee_amount),
    fulfillmentWarning: asString(data.fulfillment_warning) ?? null,
    isActive: typeof data.is_active === "boolean" ? data.is_active : true
  });
}

export async function updateProcessingRuleFromPayload(ruleId: string, payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }

  const data = payload as Record<string, unknown>;
  const input: UpdateProcessingRuleInput = {
    speciesName: asString(data.species_name),
    cutType: asString(data.cut_type),
    feeMode: asString(data.fee_mode),
    feeAmount: asNullableNumber(data.fee_amount),
    fulfillmentWarning:
      data.fulfillment_warning === null ? null : asString(data.fulfillment_warning),
    isActive: typeof data.is_active === "boolean" ? data.is_active : undefined
  };

  const updated = await updateProcessingRule(ruleId, input);
  if (!updated) {
    throw notFoundError("PROCESSING_RULE_NOT_FOUND", "손질 규칙을 찾을 수 없습니다.");
  }

  return updated;
}
