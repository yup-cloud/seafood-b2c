import { formatCurrency, formatStatusLabel } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";
import { PriceBoardItem } from "../types";
import {
  cutGuides,
  agingSheetOptions,
  getPackagingRecommendation,
  OrderItemFormState,
  packagingOptions,
  vacuumOptions
} from "./customer-order.lib";

interface CustomerOrderItemCardProps {
  item: OrderItemFormState;
  index: number;
  totalItems: number;
  orderFlow: string;
  fulfillmentType: string;
  cutTypes: string[];
  boardItems: PriceBoardItem[];
  matchedBoardItem?: PriceBoardItem;
  estimatedPriceText?: string | null;
  onRemove: (itemId: string) => void;
  onUpdate: <K extends keyof OrderItemFormState>(
    itemId: string,
    key: K,
    value: OrderItemFormState[K]
  ) => void;
  onApplyRecommendation: (itemId: string) => void;
}

export function CustomerOrderItemCard({
  item,
  index,
  totalItems,
  orderFlow,
  fulfillmentType,
  cutTypes,
  boardItems,
  matchedBoardItem,
  estimatedPriceText,
  onRemove,
  onUpdate,
  onApplyRecommendation
}: CustomerOrderItemCardProps) {
  const recommendation = getPackagingRecommendation(item.requested_cut_type, fulfillmentType);
  const packagingOptionLabel =
    packagingOptions.find((option) => option.value === item.packaging_style)?.label ?? "기본 냉장 포장";
  const agingSheetLabel =
    agingSheetOptions.find((option) => option.value === item.aging_sheet_type)?.label ?? "기본 숙성지";
  const vacuumPackagingLabel =
    vacuumOptions.find((option) => option.value === item.vacuum_packaging)?.label ??
    "일반 포장으로 받을게요";
  const recommendedPackagingLabel =
    packagingOptions.find((option) => option.value === recommendation.packaging_style)?.label ??
    "기본 냉장 포장";
  const recommendedAgingSheetLabel =
    agingSheetOptions.find((option) => option.value === recommendation.aging_sheet_type)?.label ??
    "기본 숙성지";
  const recommendedVacuumPackagingLabel =
    vacuumOptions.find((option) => option.value === recommendation.vacuum_packaging)?.label ??
    "일반 포장으로 받을게요";
  const isRecommendationApplied =
    item.packaging_style === recommendation.packaging_style &&
    item.aging_sheet_type === recommendation.aging_sheet_type &&
    item.vacuum_packaging === recommendation.vacuum_packaging;
  const isParcelSashimi = fulfillmentType === "parcel" && item.requested_cut_type === "sashimi";
  const cutGuide = cutGuides.find((guide) => guide.cutType === item.requested_cut_type);

  return (
    <article className="item-card">
      <div className="item-card-head">
        <div>
          <p className="item-card-index">품목 {index + 1}</p>
          <strong className="item-card-title">{item.item_name || `${index + 1}번째 품목`}</strong>
        </div>
        {totalItems > 1 ? (
          <button type="button" className="inline-text-button" onClick={() => onRemove(item.id)}>
            삭제
          </button>
        ) : null}
      </div>

      <div className="form-grid three">
        <label className="field-block">
          <span>{orderFlow === "same_day" ? "오늘 시세 품목 선택" : "예약 희망 품목명"}</span>
          {orderFlow === "same_day" ? (
            <div className="board-item-picker">
              {boardItems.map((boardItem) => {
                const isSelected = item.item_name === boardItem.item_name;

                return (
                  <button
                    key={boardItem.id ?? boardItem.item_name}
                    type="button"
                    className={`board-item-card${isSelected ? " active" : ""}`}
                    onClick={() => onUpdate(item.id, "item_name", boardItem.item_name)}
                  >
                    <div className="board-item-card-head">
                      <strong>{boardItem.item_name}</strong>
                      <StatusBadge value={boardItem.sale_status} />
                    </div>
                    <p>
                      {boardItem.origin_label ?? "원산지 확인"} · {boardItem.size_band ?? "중량 확인"}
                    </p>
                    <span>
                      {boardItem.unit_price ? `${formatCurrency(boardItem.unit_price)}/kg` : "가격 확인"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              list="item-options"
              value={item.item_name}
              onChange={(event) => onUpdate(item.id, "item_name", event.target.value)}
              placeholder="예: 연어, 돌돔, 광어 큰 사이즈"
              required
            />
          )}
        </label>
        <label className="field-block">
          <span>희망 크기</span>
          <input
            value={item.size_band}
            onChange={(event) => onUpdate(item.id, "size_band", event.target.value)}
            placeholder="예: 1.5kg 내외"
          />
        </label>
        <label className="field-block">
          <span>수량</span>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(event) => onUpdate(item.id, "quantity", event.target.value)}
            required
          />
        </label>
      </div>

      {matchedBoardItem ? (
        <div className="auto-price-panel">
          <div className="auto-price-head">
            <div>
              <strong>오늘 시세가 자동으로 반영되고 있어요</strong>
              <p>
                {matchedBoardItem.origin_label ?? "원산지 확인 후 안내"} · {matchedBoardItem.size_band ?? "중량 확인 후 안내"}
              </p>
            </div>
            <StatusBadge value={matchedBoardItem.sale_status} />
          </div>
          <div className="recommendation-summary">
            <span>
              시세: {matchedBoardItem.unit_price ? formatCurrency(matchedBoardItem.unit_price) : "확인 후 안내"}
              {matchedBoardItem.unit_label === "kg" ? " / kg" : ""}
            </span>
            <span>
              예상 원물가: {estimatedPriceText ?? "중량 또는 품목 상태 확인 후 안내"}
            </span>
          </div>
          {matchedBoardItem.note ? <p className="field-hint">{matchedBoardItem.note}</p> : null}
        </div>
      ) : null}

      <div className="form-grid one">
        <label className="field-block">
          <span>원하시는 손질</span>
          <select
            value={item.requested_cut_type}
            onChange={(event) => onUpdate(item.id, "requested_cut_type", event.target.value)}
          >
            {cutTypes.map((cutType) => (
              <option
                key={cutType}
                value={cutType}
                disabled={fulfillmentType === "parcel" && cutType === "sashimi"}
              >
                {formatStatusLabel(cutType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cutGuide ? (
        <div className="cut-guide-card">
          <strong>{cutGuide.title}</strong>
          <p>{cutGuide.description}</p>
          <div className="recommendation-summary">
            <span>추천 상황: {cutGuide.bestFor}</span>
          </div>
          {cutGuide.caution ? <p className="recommendation-caution">{cutGuide.caution}</p> : null}
        </div>
      ) : null}

      {isParcelSashimi ? (
        <div className="warning-stack">
          <p>회 손질은 택배로 직접 접수할 수 없어요.</p>
          <p>픽업 또는 퀵 수령으로 바꾸시거나 필렛/통손질을 선택해주세요.</p>
        </div>
      ) : null}

      <div className="choice-section">
        <div className="choice-section-head">
          <strong>포장 형태</strong>
          <p>이 품목의 손질 방식과 수령 방법에 맞춰 추천이 바뀌고, 원하시면 직접 다시 고르실 수 있어요.</p>
        </div>
        <div className="choice-grid three">
          {packagingOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`choice-card${item.packaging_style === option.value ? " active" : ""}`}
              onClick={() => onUpdate(item.id, "packaging_style", option.value)}
              aria-pressed={item.packaging_style === option.value}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`recommendation-card${isRecommendationApplied ? " matched" : ""}`}>
        <div className="recommendation-copy">
          <p className="recommendation-label">
            {isRecommendationApplied ? "추천 조합이 적용되어 있어요" : "현재 손질과 수령 방식 기준 추천 조합"}
          </p>
          <strong>{recommendation.title}</strong>
          <p>{recommendation.description}</p>
          {recommendation.caution ? <p className="recommendation-caution">{recommendation.caution}</p> : null}
        </div>
        <div className="recommendation-summary">
          <span>포장: {recommendedPackagingLabel}</span>
          <span>숙성지: {recommendedAgingSheetLabel}</span>
          <span>진공포장: {recommendedVacuumPackagingLabel}</span>
        </div>
        {!isRecommendationApplied ? (
          <button
            type="button"
            className="secondary-button compact-button"
            onClick={() => onApplyRecommendation(item.id)}
          >
            추천 조합 다시 적용
          </button>
        ) : null}
      </div>

      <div className="choice-section">
        <div className="choice-section-head">
          <strong>숙성지 선택</strong>
          <p>어종과 취향에 따라 이 품목의 숙성지 종류를 다르게 준비할 수 있어요.</p>
        </div>
        <div className="choice-grid three">
          {agingSheetOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`choice-card${item.aging_sheet_type === option.value ? " active" : ""}`}
              onClick={() => onUpdate(item.id, "aging_sheet_type", option.value)}
              aria-pressed={item.aging_sheet_type === option.value}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="choice-section">
        <div className="choice-section-head">
          <strong>진공포장 여부</strong>
          <p>진공포장은 이 품목이 필렛 손질일 때만 가능해요.</p>
        </div>
        <div className="choice-grid two">
          {vacuumOptions.map((option) => {
            const disabled = item.requested_cut_type !== "fillet" && option.value === "yes";

            return (
              <button
                key={option.value}
                type="button"
                className={`choice-card${item.vacuum_packaging === option.value ? " active" : ""}`}
                onClick={() => onUpdate(item.id, "vacuum_packaging", option.value)}
                aria-pressed={item.vacuum_packaging === option.value}
                disabled={disabled}
              >
                <strong>{option.label}</strong>
                <span>{disabled ? "필렛 손질을 선택하시면 활성화돼요." : option.description}</span>
              </button>
            );
          })}
        </div>
        <p className="field-hint">
          현재 선택: {packagingOptionLabel} · {agingSheetLabel} · {vacuumPackagingLabel}
        </p>
      </div>
    </article>
  );
}
