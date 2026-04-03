export interface OrderItemFormState {
  id: string;
  item_name: string;
  size_band: string;
  quantity: string;
  requested_cut_type: string;
  packaging_style: string;
  aging_sheet_type: string;
  vacuum_packaging: string;
}

export interface PackagingRecommendation {
  packaging_style: string;
  aging_sheet_type: string;
  vacuum_packaging: string;
  title: string;
  description: string;
  caution?: string;
}

export const packagingOptions = [
  {
    value: "ice_basic",
    label: "기본 냉장 포장",
    description: "아이스팩과 기본 보냉 포장으로 가장 무난하게 받아보실 수 있어요."
  },
  {
    value: "gift_box",
    label: "선물용 정갈 포장",
    description: "선물하거나 대접용으로 준비하실 때 보기 좋게 정리해드려요."
  },
  {
    value: "travel_safe",
    label: "이동 시간 고려 포장",
    description: "이동 시간이 길거나 택배 수령일 때 보냉을 더 신경 써서 준비해드려요."
  }
] as const;

export const agingSheetOptions = [
  {
    value: "standard",
    label: "기본 숙성지",
    description: "가장 무난한 선택으로, 처음 주문하시는 분께도 편하게 추천드려요."
  },
  {
    value: "premium",
    label: "프리미엄 숙성지",
    description: "수분 조절을 조금 더 안정적으로 도와줘 깔끔한 식감을 원하실 때 좋아요."
  },
  {
    value: "oil_absorbing",
    label: "흡유형 숙성지",
    description: "기름기 있는 어종이나 보다 담백한 마무리를 원하실 때 고려해보실 수 있어요."
  }
] as const;

export const vacuumOptions = [
  {
    value: "yes",
    label: "진공포장 원해요",
    description: "필렛 손질 시에만 가능하며, 이동과 보관이 더 편해져요."
  },
  {
    value: "no",
    label: "일반 포장으로 받을게요",
    description: "회 손질이나 즉시 드실 예정이라면 일반 포장으로도 충분해요."
  }
] as const;

function buildItemId() {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getPackagingRecommendation(
  requestedCutType: string,
  fulfillmentType: string
): PackagingRecommendation {
  const isParcel = fulfillmentType === "parcel";

  switch (requestedCutType) {
    case "fillet":
      if (isParcel) {
        return {
          packaging_style: "travel_safe",
          aging_sheet_type: "premium",
          vacuum_packaging: "yes",
          title: "필렛 + 택배 추천 조합",
          description: "필렛은 진공포장과 프리미엄 숙성지 조합이 이동 중 수분 손실을 줄여줘요.",
          caution: "택배 수령이라면 당일택배나 고속택배를 선택하시면 더 안정적이에요."
        };
      }

      if (fulfillmentType === "quick") {
        return {
          packaging_style: "ice_basic",
          aging_sheet_type: "premium",
          vacuum_packaging: "yes",
          title: "필렛 + 퀵 추천 조합",
          description: "빠르게 전달되기 때문에 진공포장과 프리미엄 숙성지 조합을 먼저 추천드려요."
        };
      }

      return {
        packaging_style: "ice_basic",
        aging_sheet_type: "premium",
        vacuum_packaging: "yes",
        title: "필렛 + 픽업 추천 조합",
        description: "집에서 바로 손질 없이 드시기 좋도록 진공포장과 프리미엄 숙성지를 추천드려요."
      };

    case "sashimi":
      if (isParcel) {
        return {
          packaging_style: "travel_safe",
          aging_sheet_type: "premium",
          vacuum_packaging: "no",
          title: "회 손질 + 택배 안내",
          description: "회 손질은 퀵이나 픽업이 가장 잘 맞고, 택배라면 보냉 포장을 더 신경 써서 준비해드려요.",
          caution: "회 손질은 택배로 직접 접수할 수 없어 픽업 또는 퀵 수령을 권해드려요."
        };
      }

      return {
        packaging_style: "gift_box",
        aging_sheet_type: "standard",
        vacuum_packaging: "no",
        title: "회 손질 추천 조합",
        description: "바로 드시는 경우가 많아 보기 좋은 일반 포장과 기본 숙성지 조합을 추천드려요."
      };

    case "masukawa":
      if (isParcel) {
        return {
          packaging_style: "travel_safe",
          aging_sheet_type: "oil_absorbing",
          vacuum_packaging: "no",
          title: "껍질 손질 + 택배 추천 조합",
          description: "표면 상태와 수분 균형을 고려해 흡유형 숙성지와 이동형 포장을 추천드려요."
        };
      }

      return {
        packaging_style: "ice_basic",
        aging_sheet_type: "oil_absorbing",
        vacuum_packaging: "no",
        title: "껍질 손질 추천 조합",
        description: "껍질 식감과 표면 컨디션을 생각하면 일반 포장과 흡유형 숙성지가 잘 맞아요."
      };

    case "sekkoshi":
      if (isParcel) {
        return {
          packaging_style: "travel_safe",
          aging_sheet_type: "standard",
          vacuum_packaging: "no",
          title: "세꼬시 + 택배 안내",
          description: "세꼬시는 식감이 중요해 보냉 포장을 강하게 넣되 일반 포장으로 추천드려요.",
          caution: "세꼬시는 가능한 퀵이나 픽업 수령이 더 잘 맞아요."
        };
      }

      return {
        packaging_style: "gift_box",
        aging_sheet_type: "standard",
        vacuum_packaging: "no",
        title: "세꼬시 추천 조합",
        description: "식감이 중요한 손질이라 진공포장보다는 일반 포장이 더 잘 어울려요."
      };

    default:
      if (isParcel) {
        return {
          packaging_style: "travel_safe",
          aging_sheet_type: "standard",
          vacuum_packaging: "no",
          title: "통손질 + 택배 추천 조합",
          description: "택배 이동 시간을 고려해 기본 숙성지와 이동형 포장을 추천드려요."
        };
      }

      return {
        packaging_style: "ice_basic",
        aging_sheet_type: "standard",
        vacuum_packaging: "no",
        title: "통손질 추천 조합",
        description: "가장 무난하게 받으실 수 있는 기본 냉장 포장을 먼저 추천드려요."
      };
  }
}

export function buildOrderItemDraft(params: {
  fulfillmentType: string;
  requestedCutType: string;
  itemName?: string;
  sizeBand?: string;
}): OrderItemFormState {
  const recommendation = getPackagingRecommendation(params.requestedCutType, params.fulfillmentType);

  return {
    id: buildItemId(),
    item_name: params.itemName ?? "",
    size_band: params.sizeBand ?? "",
    quantity: "1",
    requested_cut_type: params.requestedCutType,
    packaging_style: recommendation.packaging_style,
    aging_sheet_type: recommendation.aging_sheet_type,
    vacuum_packaging: recommendation.vacuum_packaging
  };
}

export function formatPackingOption(item: OrderItemFormState) {
  const packagingOptionLabel =
    packagingOptions.find((option) => option.value === item.packaging_style)?.label ?? "기본 냉장 포장";
  const agingSheetLabel =
    agingSheetOptions.find((option) => option.value === item.aging_sheet_type)?.label ?? "기본 숙성지";
  const vacuumPackagingLabel =
    vacuumOptions.find((option) => option.value === item.vacuum_packaging)?.label ?? "일반 포장으로 받을게요";

  return `${packagingOptionLabel} / ${agingSheetLabel} / ${vacuumPackagingLabel}`;
}
