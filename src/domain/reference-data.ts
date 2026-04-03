export const purchaseUnits = ["whole", "half_request"] as const;
export const fulfillmentTypes = ["pickup", "quick", "parcel"] as const;
export const parcelSubtypes = ["parcel_standard", "parcel_same_day", "parcel_bus"] as const;
export const cutTypes = ["raw", "fillet", "sashimi", "masukawa", "sekkoshi"] as const;

export const orderStatuses = [
  "new",
  "pricing_pending",
  "waiting_payment",
  "payment_review",
  "ready_for_prep",
  "in_prep",
  "packed",
  "ready_for_handoff",
  "completed",
  "cancelled"
] as const;

export const pricingStatuses = ["quote_not_needed", "quote_pending", "quoted", "requoted"] as const;

export const paymentStatuses = [
  "unpaid",
  "review_required",
  "manual_confirmed",
  "auto_confirmed",
  "partial_paid",
  "over_paid",
  "refund_required"
] as const;

export const fulfillmentStatuses = [
  "pickup_waiting",
  "pickup_done",
  "quick_waiting",
  "quick_sent",
  "parcel_waiting",
  "parcel_sent"
] as const;

export const matchStatuses = [
  "match_not_needed",
  "matching_waiting",
  "matching_review",
  "matched",
  "match_failed"
] as const;

export const saleStatuses = ["available", "reserved_only", "sold_out"] as const;

export type PurchaseUnit = (typeof purchaseUnits)[number];
export type FulfillmentType = (typeof fulfillmentTypes)[number];
export type ParcelSubtype = (typeof parcelSubtypes)[number];
export type CutType = (typeof cutTypes)[number];
export type OrderStatus = (typeof orderStatuses)[number];
export type PricingStatus = (typeof pricingStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type FulfillmentStatus = (typeof fulfillmentStatuses)[number];
export type MatchStatus = (typeof matchStatuses)[number];
export type SaleStatus = (typeof saleStatuses)[number];

export const statusGroups = {
  order: orderStatuses,
  pricing: pricingStatuses,
  payment: paymentStatuses,
  fulfillment: fulfillmentStatuses,
  match: matchStatuses
} as const;

export type StatusGroup = keyof typeof statusGroups;
