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

export interface OrderStarterPreset {
  id: string;
  title: string;
  description: string;
  orderFlow: string;
  fulfillmentType: string;
  cutType: string;
  badge: string;
}

export interface CutGuide {
  cutType: string;
  title: string;
  description: string;
  bestFor: string;
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
    label: "일반 숙성지",
    description: "가장 무난한 기본 선택이에요."
  },
  {
    value: "premium",
    label: "고급 숙성지",
    description: "조금 더 깔끔한 컨디션을 원하실 때 좋아요."
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

export const orderStarterPresets: OrderStarterPreset[] = [
  {
    id: "beginner-home",
    title: "처음 주문 추천",
    description: "가장 무난한 시작 조합",
    orderFlow: "same_day",
    fulfillmentType: "pickup",
    cutType: "fillet",
    badge: "초보 추천"
  },
  {
    id: "same-day-eat",
    title: "오늘 바로 드실 분",
    description: "당일 식사에 잘 맞는 조합",
    orderFlow: "same_day",
    fulfillmentType: "quick",
    cutType: "sashimi",
    badge: "당일 수령"
  },
  {
    id: "travel-safe",
    title: "택배·이동 거리",
    description: "택배와 장거리 이동 추천",
    orderFlow: "reservation",
    fulfillmentType: "parcel",
    cutType: "fillet",
    badge: "안전 포장"
  }
];

export const cutGuides: CutGuide[] = [
  {
    cutType: "raw",
    title: "원물 그대로",
    description: "손질 전 상태 그대로 받아 직접 손질하거나 업체 손질을 따로 맡기실 때 좋아요.",
    bestFor: "직접 손질 예정 / 원물 상태 확인이 중요한 주문",
    caution: "원물은 진공포장이 되지 않고, 바로 드시기엔 추가 손질이 필요해요."
  },
  {
    cutType: "fillet",
    title: "오로시 · 필렛",
    description: "뼈와 내장을 정리해 가장 무난하게 받아보는 방식이라 처음 주문하시는 분께 추천드려요.",
    bestFor: "초보 주문 / 택배 수령 / 집에서 편하게 손질 마무리",
    caution: "회처럼 바로 드실 수 있는 상태는 아니고, 썰기만 조금 더 하시면 돼요."
  },
  {
    cutType: "sashimi",
    title: "회 손질",
    description: "받자마자 바로 드실 수 있게 회 작업까지 마친 상태예요.",
    bestFor: "당일 식사 / 픽업 또는 퀵 / 손님상 준비",
    caution: "택배보다는 픽업이나 퀵이 훨씬 안정적이에요."
  },
  {
    cutType: "masukawa",
    title: "마스까와 · 껍질 작업",
    description: "껍질 식감을 살리는 작업이 들어가서 감칠맛과 식감을 함께 원할 때 좋아요.",
    bestFor: "도미류 / 껍질 식감 선호 / 대접용",
    caution: "어종과 상태에 따라 별도 손질비가 추가될 수 있어요."
  },
  {
    cutType: "sekkoshi",
    title: "세꼬시",
    description: "뼈째 얇게 썰어 식감을 살리는 방식이라 선호가 분명한 손질이에요.",
    bestFor: "식감 위주 선호 / 빠른 당일 섭취",
    caution: "택배보다 픽업이나 퀵에 더 잘 맞고, 처음 주문이면 필렛이나 회 손질이 더 무난해요."
  }
];

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
          aging_sheet_type: "premium",
          vacuum_packaging: "no",
          title: "껍질 손질 + 택배 추천 조합",
          description: "표면 상태와 수분 균형을 고려해 고급 숙성지와 이동형 포장을 추천드려요."
        };
      }

      return {
        packaging_style: "ice_basic",
        aging_sheet_type: "premium",
        vacuum_packaging: "no",
        title: "껍질 손질 추천 조합",
        description: "껍질 식감과 표면 컨디션을 생각하면 일반 포장과 고급 숙성지가 잘 맞아요."
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
