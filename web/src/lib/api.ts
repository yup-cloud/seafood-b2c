import {
  AdminOrderDetail,
  AdminOrdersResponse,
  FulfillmentQueueItem,
  OrderFormOptions,
  PaymentReviewItem,
  PriceBoardResponse,
  PublicOrderPayload,
  PublicOrderResult,
  PublicOrderStatus,
  StoreInfo
} from "../types";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export interface AdminOrderFilters {
  search?: string;
  order_status?: string;
  pricing_status?: string;
  payment_status?: string;
  fulfillment_status?: string;
  match_status?: string;
  is_reservation?: string;
}

function buildQueryString(filters?: AdminOrderFilters): string {
  if (!filters) return "";
  const searchParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    throw new Error(errorPayload?.error.message ?? "요청 처리 중 오류가 발생했습니다.");
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

export const api = {
  getStore: () => request<StoreInfo>("/public/store"),
  getPriceBoard: () => request<PriceBoardResponse>("/public/price-board/today"),
  getOrderOptions: () => request<OrderFormOptions>("/public/order-form/options"),
  createOrder: (payload: PublicOrderPayload) =>
    request<PublicOrderResult>("/public/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getPublicOrder: (publicToken: string) => request<PublicOrderStatus>(`/public/orders/${publicToken}`),
  getPublicOrderByOrderNo: (orderNo: string) =>
    request<PublicOrderStatus>(`/public/orders/lookup/${encodeURIComponent(orderNo)}`),
  getAdminOrders: (filters?: AdminOrderFilters) =>
    request<AdminOrdersResponse>(`/admin/orders${buildQueryString(filters)}`),
  getAdminPriceBoard: (date?: string) =>
    request<{ date: string | null; boards: Array<{ id: string; board_date: string; status: string }>; items: PriceBoardResponse["items"] }>(
      `/admin/price-board${date ? `?date=${encodeURIComponent(date)}` : ""}`
    ),
  upsertAdminPriceBoard: (payload: { board_date: string; title?: string }) =>
    request<{ batch: { id: string; board_date: string; status: string } }>("/admin/price-board", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  createAdminPriceBoardItem: (payload: {
    batch_id: string;
    item_name: string;
    origin_label?: string | null;
    size_band?: string | null;
    unit_price?: number | null;
    unit_label?: string;
    sale_status: string;
    reservable_flag?: boolean;
    reservation_cutoff_note?: string | null;
    note?: string | null;
    sort_order?: number;
  }) =>
    request<{ item: unknown }>("/admin/price-board/items", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  patchAdminPriceBoardItem: (
    itemId: string,
    payload: {
      item_name?: string;
      origin_label?: string | null;
      size_band?: string | null;
      unit_price?: number | null;
      unit_label?: string;
      sale_status?: string;
      reservable_flag?: boolean;
      reservation_cutoff_note?: string | null;
      note?: string | null;
      sort_order?: number;
    }
  ) =>
    request<{ item: unknown }>(`/admin/price-board/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  publishAdminPriceBoard: (batchId: string) =>
    request(`/admin/price-board/${batchId}/publish`, {
      method: "POST"
    }),
  getAdminOrder: (orderId: string) => request<AdminOrderDetail>(`/admin/orders/${orderId}`),
  submitQuote: (
    orderId: string,
    payload: {
      item_subtotal: number;
      processing_fee_total: number;
      delivery_fee_total: number;
      discount_total: number;
      final_amount: number;
      receipt_type_note?: string;
      payment_method_note?: string;
      quote_note?: string;
    }
  ) =>
    request(`/admin/orders/${orderId}/quote`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  confirmPayment: (orderId: string, confirmedAmount: number, note?: string) =>
    request(`/admin/orders/${orderId}/payments/manual-confirm`, {
      method: "POST",
      body: JSON.stringify({
        confirmed_amount: confirmedAmount,
        note
      })
    }),
  updateFulfillment: (
    orderId: string,
    payload: {
      fulfillment_status?: string;
      fulfillment_subtype?: string;
      parcel_tracking_no?: string;
      packing_note?: string;
    }
  ) =>
    request(`/admin/orders/${orderId}/fulfillment`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getPaymentReviewQueue: () =>
    request<{ review_queue: PaymentReviewItem[] }>("/admin/payment-review"),
  getFulfillments: () =>
    request<{ fulfillments: FulfillmentQueueItem[] }>("/admin/fulfillments")
};
