export interface StoreInfo {
  name: string;
  phones: string[];
  bank_guide: {
    bank_name: string | null;
    bank_account: string | null;
    bank_holder: string | null;
  };
  address: {
    line1: string | null;
    line2: string | null;
  };
  business_hours_note: string | null;
}

export interface PriceBoardItem {
  id?: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  unit_price: string | null;
  unit_label: string;
  sale_status: string;
  reservable_flag: boolean;
  reservation_cutoff_note: string | null;
  note?: string | null;
}

export interface PriceBoardResponse {
  board_date: string;
  items: PriceBoardItem[];
  order_guide: {
    pickup_note: string;
    quick_note: string;
    parcel_note: string;
    processing_rules_summary: string[];
    cutoff_windows?: Array<{
      fulfillment_type: string;
      label: string;
      cutoff_note: string;
    }>;
    expected_price_note?: string | null;
    reservation_deposit_policy?: string | null;
  };
}

export interface ProcessingRule {
  id: string;
  species_name: string;
  cut_type: string;
  fee_mode: string;
  fee_amount: string | null;
  fulfillment_warning: string | null;
  is_active: boolean;
}

export interface OrderFormOptions {
  purchase_units: string[];
  fulfillment_types: string[];
  parcel_subtypes: string[];
  cut_types: string[];
  processing_fee_rules: ProcessingRule[];
  store_id: string;
  warnings: string[];
}

export interface PublicOrderPayload {
  customer_name: string;
  customer_phone: string;
  depositor_name?: string;
  purchase_unit: string;
  requested_date?: string;
  requested_time_slot?: string;
  fulfillment_type: string;
  fulfillment_subtype?: string;
  receiver_name?: string;
  receiver_phone?: string;
  postal_code?: string;
  address_line1?: string;
  address_line2?: string;
  customer_request?: string;
  items: Array<{
    item_name: string;
    origin_label?: string | null;
    size_band?: string | null;
    quantity: number;
    unit_label: string;
    requested_cut_type?: string | null;
    packing_option?: string | null;
    unit_price?: number | null;
    estimated_total?: number | null;
  }>;
}

export interface PublicOrderResult {
  order_id: string;
  order_no: string;
  public_token: string;
  order_status: string;
  pricing_status: string;
  payment_status: string;
}

export interface PublicOrderStatus {
  public_token: string;
  order_no: string;
  order_status: string;
  pricing_status: string;
  payment_status: string;
  fulfillment_status: string;
  quoted_amount: string | null;
  bank_guide: {
    bank_name: string | null;
    bank_account: string | null;
    bank_holder: string | null;
  };
  next_step_message: string;
}

export interface HalfOrderDemandItem {
  id: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  unit_price: string | null;
  wanted_portion_label: string;
  waiting_count: number;
  fulfillment_hint: string;
  urgency_label: string;
  note?: string | null;
}

export interface AdminOrderListItem {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  item_summary: string | null;
  requested_date: string | null;
  requested_time_slot: string | null;
  pricing_status: string;
  payment_status: string;
  fulfillment_status: string;
  match_status: string;
  order_status: string;
  fulfillment_type: string;
  is_reservation: boolean;
  created_at: string;
}

export interface AdminOrdersResponse {
  filters: Record<string, string | null>;
  orders: AdminOrderListItem[];
}

export interface AdminOrderItem {
  id: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  quantity: string;
  unit_label: string;
  requested_cut_type: string | null;
  packing_option: string | null;
}

export interface AdminOrderQuote {
  id: string;
  item_subtotal: string;
  processing_fee_total: string;
  delivery_fee_total: string;
  discount_total: string;
  final_amount: string;
  receipt_type_note: string | null;
  payment_method_note: string | null;
  quote_note: string | null;
}

export interface AdminPayment {
  id: string;
  expected_amount: string;
  paid_amount: string;
  payment_status: string;
  confirmed_by_mode: string | null;
  confirmed_at: string | null;
  note: string | null;
}

export interface AdminFulfillment {
  id: string;
  fulfillment_type: string;
  fulfillment_subtype: string | null;
  fulfillment_status: string;
  quick_dispatch_note: string | null;
  parcel_tracking_no: string | null;
  packing_note: string | null;
  handed_off_at: string | null;
}

export interface AdminStatusLog {
  id: string;
  status_group: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export interface AdminOrderDetail {
  id: string;
  order_no: string;
  order_status: string;
  pricing_status: string;
  payment_status: string;
  fulfillment_status: string;
  fulfillment_type: string;
  fulfillment_subtype: string | null;
  customer_name: string;
  customer_phone: string;
  depositor_name: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  requested_date: string | null;
  requested_time_slot: string | null;
  address_line1: string | null;
  address_line2: string | null;
  customer_request: string | null;
  items: AdminOrderItem[];
  quote: AdminOrderQuote | null;
  payment: AdminPayment | null;
  fulfillment: AdminFulfillment | null;
  status_logs: AdminStatusLog[];
}

export interface FulfillmentQueueItem {
  id: string;
  order_id: string;
  order_no: string;
  customer_name: string;
  fulfillment_type: string;
  fulfillment_subtype: string | null;
  fulfillment_status: string;
  parcel_tracking_no: string | null;
  requested_date: string | null;
}

export interface PaymentReviewItem {
  order_id: string;
  order_no: string;
  customer_name: string;
  expected_amount: string | null;
  review_reason: string;
  transaction_candidates: Array<{
    id: string;
    depositor_name: string | null;
    amount: string;
    transaction_at: string;
  }>;
}
