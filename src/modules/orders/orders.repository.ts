import { Queryable, db } from "../../lib/db";

export interface OrderRecord {
  id: string;
  store_id: string;
  order_no: string;
  public_token: string;
  order_status: string;
  pricing_status: string;
  payment_status: string;
  fulfillment_type: string;
  fulfillment_subtype: string | null;
  fulfillment_status: string;
  purchase_unit: string;
  match_status: string;
  requested_date: string | null;
  requested_time_slot: string | null;
  requested_at_note: string | null;
  is_reservation: boolean;
  reservation_target_date: string | null;
  item_hold_request_note: string | null;
  customer_name: string;
  customer_phone: string;
  depositor_name: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  postal_code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  entrance_password: string | null;
  customer_request: string | null;
  internal_note: string | null;
  source_channel: string;
  created_at: string;
  updated_at: string;
}

export interface OrderListRecord {
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

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  quantity: string;
  unit_label: string;
  requested_cut_type: string | null;
  packing_option: string | null;
  unit_price: string | null;
  estimated_total: string | null;
  created_at: string;
}

export interface OrderQuoteRecord {
  id: string;
  order_id: string;
  item_subtotal: string;
  processing_fee_total: string;
  delivery_fee_total: string;
  discount_total: string;
  final_amount: string;
  receipt_type_note: string | null;
  payment_method_note: string | null;
  quote_note: string | null;
  quoted_at: string;
  revised_count: number;
}

export interface PaymentRecord {
  id: string;
  order_id: string;
  expected_amount: string;
  paid_amount: string;
  payment_status: string;
  confirmed_by_mode: string | null;
  confirmed_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FulfillmentRecord {
  id: string;
  order_id: string;
  fulfillment_type: string;
  fulfillment_subtype: string | null;
  fulfillment_status: string;
  quick_request_time: string | null;
  quick_dispatch_note: string | null;
  parcel_tracking_no: string | null;
  packing_note: string | null;
  handed_off_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusLogRecord {
  id: string;
  order_id: string;
  status_group: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  created_at: string;
}

export interface CreateOrderInput {
  storeId: string;
  orderNo: string;
  publicToken: string;
  orderStatus: string;
  pricingStatus: string;
  paymentStatus: string;
  fulfillmentType: string;
  fulfillmentSubtype?: string | null;
  fulfillmentStatus: string;
  purchaseUnit: string;
  matchStatus: string;
  requestedDate?: string | null;
  requestedTimeSlot?: string | null;
  requestedAtNote?: string | null;
  isReservation?: boolean;
  reservationTargetDate?: string | null;
  itemHoldRequestNote?: string | null;
  customerName: string;
  customerPhone: string;
  depositorName?: string | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  postalCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  entrancePassword?: string | null;
  customerRequest?: string | null;
  internalNote?: string | null;
  sourceChannel?: string;
}

export async function createOrderRecord(input: CreateOrderInput, executor: Queryable = db): Promise<OrderRecord> {
  const result = await executor.query<OrderRecord>(
    `
      insert into orders (
        store_id,
        order_no,
        public_token,
        order_status,
        pricing_status,
        payment_status,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        purchase_unit,
        match_status,
        requested_date,
        requested_time_slot,
        requested_at_note,
        is_reservation,
        reservation_target_date,
        item_hold_request_note,
        customer_name,
        customer_phone,
        depositor_name,
        receiver_name,
        receiver_phone,
        postal_code,
        address_line1,
        address_line2,
        entrance_password,
        customer_request,
        internal_note,
        source_channel
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29
      )
      returning
        id,
        store_id,
        order_no,
        public_token,
        order_status,
        pricing_status,
        payment_status,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        purchase_unit,
        match_status,
        requested_date::text,
        requested_time_slot,
        requested_at_note,
        is_reservation,
        reservation_target_date::text,
        item_hold_request_note,
        customer_name,
        customer_phone,
        depositor_name,
        receiver_name,
        receiver_phone,
        postal_code,
        address_line1,
        address_line2,
        entrance_password,
        customer_request,
        internal_note,
        source_channel,
        created_at::text,
        updated_at::text
    `,
    [
      input.storeId,
      input.orderNo,
      input.publicToken,
      input.orderStatus,
      input.pricingStatus,
      input.paymentStatus,
      input.fulfillmentType,
      input.fulfillmentSubtype ?? null,
      input.fulfillmentStatus,
      input.purchaseUnit,
      input.matchStatus,
      input.requestedDate ?? null,
      input.requestedTimeSlot ?? null,
      input.requestedAtNote ?? null,
      input.isReservation ?? false,
      input.reservationTargetDate ?? null,
      input.itemHoldRequestNote ?? null,
      input.customerName,
      input.customerPhone,
      input.depositorName ?? null,
      input.receiverName ?? null,
      input.receiverPhone ?? null,
      input.postalCode ?? null,
      input.addressLine1 ?? null,
      input.addressLine2 ?? null,
      input.entrancePassword ?? null,
      input.customerRequest ?? null,
      input.internalNote ?? null,
      input.sourceChannel ?? "kakao_openchat"
    ]
  );

  return result.rows[0];
}

export interface CreateOrderItemInput {
  orderId: string;
  itemName: string;
  originLabel?: string | null;
  sizeBand?: string | null;
  quantity: number;
  unitLabel: string;
  requestedCutType?: string | null;
  packingOption?: string | null;
  unitPrice?: number | null;
  estimatedTotal?: number | null;
}

export async function createOrderItems(
  items: CreateOrderItemInput[],
  executor: Queryable = db
): Promise<OrderItemRecord[]> {
  if (items.length === 0) {
    return [];
  }

  const created: OrderItemRecord[] = [];
  for (const item of items) {
    const result = await executor.query<OrderItemRecord>(
      `
        insert into order_items (
          order_id,
          item_name,
          origin_label,
          size_band,
          quantity,
          unit_label,
          requested_cut_type,
          packing_option,
          unit_price,
          estimated_total
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning
          id,
          order_id,
          item_name,
          origin_label,
          size_band,
          quantity::text,
          unit_label,
          requested_cut_type,
          packing_option,
          unit_price::text,
          estimated_total::text,
          created_at::text
      `,
      [
        item.orderId,
        item.itemName,
        item.originLabel ?? null,
        item.sizeBand ?? null,
        item.quantity,
        item.unitLabel,
        item.requestedCutType ?? null,
        item.packingOption ?? null,
        item.unitPrice ?? null,
        item.estimatedTotal ?? null
      ]
    );
    created.push(result.rows[0]);
  }

  return created;
}

export interface CreateFulfillmentInput {
  orderId: string;
  fulfillmentType: string;
  fulfillmentSubtype?: string | null;
  fulfillmentStatus: string;
}

export async function createFulfillmentRecord(
  input: CreateFulfillmentInput,
  executor: Queryable = db
): Promise<FulfillmentRecord> {
  const result = await executor.query<FulfillmentRecord>(
    `
      insert into fulfillments (
        order_id,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status
      )
      values ($1, $2, $3, $4)
      returning
        id,
        order_id,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        quick_request_time::text,
        quick_dispatch_note,
        parcel_tracking_no,
        packing_note,
        handed_off_at::text,
        created_at::text,
        updated_at::text
    `,
    [input.orderId, input.fulfillmentType, input.fulfillmentSubtype ?? null, input.fulfillmentStatus]
  );

  return result.rows[0];
}

export async function listOrders(
  storeId: string,
  filters: Record<string, string>,
  executor: Queryable = db
): Promise<OrderListRecord[]> {
  const values: string[] = [storeId];
  const where = ["o.store_id = $1"];

  if (filters.date) {
    values.push(filters.date);
    where.push(`o.requested_date = $${values.length}`);
  }
  if (filters.order_status) {
    values.push(filters.order_status);
    where.push(`o.order_status = $${values.length}`);
  }
  if (filters.pricing_status) {
    values.push(filters.pricing_status);
    where.push(`o.pricing_status = $${values.length}`);
  }
  if (filters.payment_status) {
    values.push(filters.payment_status);
    where.push(`o.payment_status = $${values.length}`);
  }
  if (filters.fulfillment_status) {
    values.push(filters.fulfillment_status);
    where.push(`o.fulfillment_status = $${values.length}`);
  }
  if (filters.match_status) {
    values.push(filters.match_status);
    where.push(`o.match_status = $${values.length}`);
  }
  if (filters.is_reservation) {
    values.push(filters.is_reservation);
    where.push(`o.is_reservation = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    where.push(`(
      o.order_no ilike $${values.length}
      or o.customer_name ilike $${values.length}
      or o.customer_phone ilike $${values.length}
      or exists (
        select 1
        from order_items oi2
        where oi2.order_id = o.id
          and oi2.item_name ilike $${values.length}
      )
    )`);
  }

  const result = await executor.query<OrderListRecord>(
    `
      select
        o.id,
        o.order_no,
        o.customer_name,
        o.customer_phone,
        string_agg(distinct oi.item_name, ', ' order by oi.item_name) as item_summary,
        o.requested_date::text,
        o.requested_time_slot,
        o.pricing_status,
        o.payment_status,
        o.fulfillment_status,
        o.match_status,
        o.order_status,
        o.fulfillment_type,
        o.is_reservation,
        o.created_at::text
      from orders o
      left join order_items oi on oi.order_id = o.id
      where ${where.join(" and ")}
      group by o.id
      order by o.created_at desc
    `,
    values
  );

  return result.rows;
}

export async function getOrderById(orderId: string, executor: Queryable = db): Promise<OrderRecord | null> {
  const result = await executor.query<OrderRecord>(
    `
      select
        id,
        store_id,
        order_no,
        public_token,
        order_status,
        pricing_status,
        payment_status,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        purchase_unit,
        match_status,
        requested_date::text,
        requested_time_slot,
        requested_at_note,
        is_reservation,
        reservation_target_date::text,
        item_hold_request_note,
        customer_name,
        customer_phone,
        depositor_name,
        receiver_name,
        receiver_phone,
        postal_code,
        address_line1,
        address_line2,
        entrance_password,
        customer_request,
        internal_note,
        source_channel,
        created_at::text,
        updated_at::text
      from orders
      where id = $1
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

export async function getOrderByPublicToken(
  publicToken: string,
  executor: Queryable = db
): Promise<OrderRecord | null> {
  const result = await executor.query<OrderRecord>(
    `
      select
        id,
        store_id,
        order_no,
        public_token,
        order_status,
        pricing_status,
        payment_status,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        purchase_unit,
        match_status,
        requested_date::text,
        requested_time_slot,
        requested_at_note,
        is_reservation,
        reservation_target_date::text,
        item_hold_request_note,
        customer_name,
        customer_phone,
        depositor_name,
        receiver_name,
        receiver_phone,
        postal_code,
        address_line1,
        address_line2,
        entrance_password,
        customer_request,
        internal_note,
        source_channel,
        created_at::text,
        updated_at::text
      from orders
      where public_token = $1
    `,
    [publicToken]
  );

  return result.rows[0] ?? null;
}

export async function getOrderItems(orderId: string, executor: Queryable = db): Promise<OrderItemRecord[]> {
  const result = await executor.query<OrderItemRecord>(
    `
      select
        id,
        order_id,
        item_name,
        origin_label,
        size_band,
        quantity::text,
        unit_label,
        requested_cut_type,
        packing_option,
        unit_price::text,
        estimated_total::text,
        created_at::text
      from order_items
      where order_id = $1
      order by created_at asc
    `,
    [orderId]
  );

  return result.rows;
}

export async function getOrderQuote(orderId: string, executor: Queryable = db): Promise<OrderQuoteRecord | null> {
  const result = await executor.query<OrderQuoteRecord>(
    `
      select
        id,
        order_id,
        item_subtotal::text,
        processing_fee_total::text,
        delivery_fee_total::text,
        discount_total::text,
        final_amount::text,
        receipt_type_note,
        payment_method_note,
        quote_note,
        quoted_at::text,
        revised_count
      from order_quotes
      where order_id = $1
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

export async function getPayment(orderId: string, executor: Queryable = db): Promise<PaymentRecord | null> {
  const result = await executor.query<PaymentRecord>(
    `
      select
        id,
        order_id,
        expected_amount::text,
        paid_amount::text,
        payment_status,
        confirmed_by_mode,
        confirmed_at::text,
        note,
        created_at::text,
        updated_at::text
      from payments
      where order_id = $1
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

export async function getFulfillment(
  orderId: string,
  executor: Queryable = db
): Promise<FulfillmentRecord | null> {
  const result = await executor.query<FulfillmentRecord>(
    `
      select
        id,
        order_id,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        quick_request_time::text,
        quick_dispatch_note,
        parcel_tracking_no,
        packing_note,
        handed_off_at::text,
        created_at::text,
        updated_at::text
      from fulfillments
      where order_id = $1
    `,
    [orderId]
  );

  return result.rows[0] ?? null;
}

export async function getOrderStatusLogs(
  orderId: string,
  executor: Queryable = db
): Promise<StatusLogRecord[]> {
  const result = await executor.query<StatusLogRecord>(
    `
      select
        id,
        order_id,
        status_group,
        from_status,
        to_status,
        reason,
        created_at::text
      from order_status_logs
      where order_id = $1
      order by created_at desc
    `,
    [orderId]
  );

  return result.rows;
}

export async function updateOrderRecord(
  orderId: string,
  fields: Record<string, string | boolean | null>,
  executor: Queryable = db
): Promise<OrderRecord | null> {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return getOrderById(orderId, executor);
  }

  const updates = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(orderId);

  const result = await executor.query<OrderRecord>(
    `
      update orders
      set
        ${updates.join(", ")},
        updated_at = now()
      where id = $${values.length}
      returning
        id,
        store_id,
        order_no,
        public_token,
        order_status,
        pricing_status,
        payment_status,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        purchase_unit,
        match_status,
        requested_date::text,
        requested_time_slot,
        requested_at_note,
        is_reservation,
        reservation_target_date::text,
        item_hold_request_note,
        customer_name,
        customer_phone,
        depositor_name,
        receiver_name,
        receiver_phone,
        postal_code,
        address_line1,
        address_line2,
        entrance_password,
        customer_request,
        internal_note,
        source_channel,
        created_at::text,
        updated_at::text
    `,
    values
  );

  return result.rows[0] ?? null;
}

export interface CreateStatusLogInput {
  orderId: string;
  statusGroup: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
}

export async function insertOrderStatusLog(
  input: CreateStatusLogInput,
  executor: Queryable = db
): Promise<void> {
  await executor.query(
    `
      insert into order_status_logs (
        order_id,
        status_group,
        from_status,
        to_status,
        reason
      )
      values ($1, $2, $3, $4, $5)
    `,
    [input.orderId, input.statusGroup, input.fromStatus ?? null, input.toStatus, input.reason ?? null]
  );
}

export interface UpsertQuoteInput {
  orderId: string;
  itemSubtotal: number;
  processingFeeTotal: number;
  deliveryFeeTotal: number;
  discountTotal: number;
  finalAmount: number;
  receiptTypeNote?: string | null;
  paymentMethodNote?: string | null;
  quoteNote?: string | null;
}

export async function upsertOrderQuote(
  input: UpsertQuoteInput,
  executor: Queryable = db
): Promise<OrderQuoteRecord> {
  const result = await executor.query<OrderQuoteRecord>(
    `
      insert into order_quotes (
        order_id,
        item_subtotal,
        processing_fee_total,
        delivery_fee_total,
        discount_total,
        final_amount,
        receipt_type_note,
        payment_method_note,
        quote_note
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (order_id) do update
      set
        item_subtotal = excluded.item_subtotal,
        processing_fee_total = excluded.processing_fee_total,
        delivery_fee_total = excluded.delivery_fee_total,
        discount_total = excluded.discount_total,
        final_amount = excluded.final_amount,
        receipt_type_note = excluded.receipt_type_note,
        payment_method_note = excluded.payment_method_note,
        quote_note = excluded.quote_note,
        revised_count = order_quotes.revised_count + 1,
        quoted_at = now()
      returning
        id,
        order_id,
        item_subtotal::text,
        processing_fee_total::text,
        delivery_fee_total::text,
        discount_total::text,
        final_amount::text,
        receipt_type_note,
        payment_method_note,
        quote_note,
        quoted_at::text,
        revised_count
    `,
    [
      input.orderId,
      input.itemSubtotal,
      input.processingFeeTotal,
      input.deliveryFeeTotal,
      input.discountTotal,
      input.finalAmount,
      input.receiptTypeNote ?? null,
      input.paymentMethodNote ?? null,
      input.quoteNote ?? null
    ]
  );

  return result.rows[0];
}

export interface UpsertPaymentInput {
  orderId: string;
  expectedAmount: number;
  paidAmount: number;
  paymentStatus: string;
  confirmedByMode?: string | null;
  confirmedAt?: string | null;
  note?: string | null;
}

export async function upsertPayment(
  input: UpsertPaymentInput,
  executor: Queryable = db
): Promise<PaymentRecord> {
  const result = await executor.query<PaymentRecord>(
    `
      insert into payments (
        order_id,
        expected_amount,
        paid_amount,
        payment_status,
        confirmed_by_mode,
        confirmed_at,
        note
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (order_id) do update
      set
        expected_amount = excluded.expected_amount,
        paid_amount = excluded.paid_amount,
        payment_status = excluded.payment_status,
        confirmed_by_mode = excluded.confirmed_by_mode,
        confirmed_at = excluded.confirmed_at,
        note = excluded.note,
        updated_at = now()
      returning
        id,
        order_id,
        expected_amount::text,
        paid_amount::text,
        payment_status,
        confirmed_by_mode,
        confirmed_at::text,
        note,
        created_at::text,
        updated_at::text
    `,
    [
      input.orderId,
      input.expectedAmount,
      input.paidAmount,
      input.paymentStatus,
      input.confirmedByMode ?? null,
      input.confirmedAt ?? null,
      input.note ?? null
    ]
  );

  return result.rows[0];
}

export interface CreatePaymentEventInput {
  paymentId: string;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
}

export async function createPaymentEvent(
  input: CreatePaymentEventInput,
  executor: Queryable = db
): Promise<void> {
  await executor.query(
    `
      insert into payment_events (
        payment_id,
        from_status,
        to_status,
        reason
      )
      values ($1, $2, $3, $4)
    `,
    [input.paymentId, input.fromStatus ?? null, input.toStatus, input.reason ?? null]
  );
}

export async function updateFulfillmentRecord(
  orderId: string,
  fields: Record<string, string | null>,
  executor: Queryable = db
): Promise<FulfillmentRecord | null> {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return getFulfillment(orderId, executor);
  }

  const updates = entries.map(([column], index) => `${column} = $${index + 1}`);
  const values = entries.map(([, value]) => value);
  values.push(orderId);

  const result = await executor.query<FulfillmentRecord>(
    `
      update fulfillments
      set
        ${updates.join(", ")},
        updated_at = now()
      where order_id = $${values.length}
      returning
        id,
        order_id,
        fulfillment_type,
        fulfillment_subtype,
        fulfillment_status,
        quick_request_time::text,
        quick_dispatch_note,
        parcel_tracking_no,
        packing_note,
        handed_off_at::text,
        created_at::text,
        updated_at::text
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function listFulfillments(
  storeId: string,
  filters: Record<string, string>,
  executor: Queryable = db
): Promise<Array<FulfillmentRecord & { order_no: string; customer_name: string; requested_date: string | null }>> {
  const values: string[] = [storeId];
  const where = ["o.store_id = $1"];

  if (filters.fulfillment_type) {
    values.push(filters.fulfillment_type);
    where.push(`f.fulfillment_type = $${values.length}`);
  }
  if (filters.fulfillment_status) {
    values.push(filters.fulfillment_status);
    where.push(`f.fulfillment_status = $${values.length}`);
  }
  if (filters.date) {
    values.push(filters.date);
    where.push(`o.requested_date = $${values.length}`);
  }

  const result = await executor.query<Array<FulfillmentRecord & { order_no: string; customer_name: string; requested_date: string | null }> extends (infer T)[] ? T : never>(
    `
      select
        f.id,
        f.order_id,
        f.fulfillment_type,
        f.fulfillment_subtype,
        f.fulfillment_status,
        f.quick_request_time::text,
        f.quick_dispatch_note,
        f.parcel_tracking_no,
        f.packing_note,
        f.handed_off_at::text,
        f.created_at::text,
        f.updated_at::text,
        o.order_no,
        o.customer_name,
        o.requested_date::text
      from fulfillments f
      join orders o on o.id = f.order_id
      where ${where.join(" and ")}
      order by o.requested_date asc nulls last, o.requested_time_slot asc nulls last, o.created_at asc
    `,
    values
  );

  return result.rows;
}
