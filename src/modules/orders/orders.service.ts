import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import {
  cutTypes,
  fulfillmentStatuses,
  fulfillmentTypes,
  matchStatuses,
  orderStatuses,
  parcelSubtypes,
  paymentStatuses,
  pricingStatuses,
  purchaseUnits,
  statusGroups
} from "../../domain/reference-data";
import { withTransaction } from "../../lib/db";
import { AppError, notFoundError, validationError } from "../../lib/errors";
import { listProcessingRules } from "../processing-rules/processing-rules.repository";
import { getDefaultStore } from "../stores/stores.service";
import {
  createPaymentEvent,
  createFulfillmentRecord,
  createOrderItems,
  createOrderRecord,
  getFulfillment,
  getOrderById,
  getOrderByPublicToken,
  getOrderItems,
  getOrderQuote,
  getOrderStatusLogs,
  getPayment,
  insertOrderStatusLog,
  listFulfillments,
  listOrders,
  OrderRecord,
  updateFulfillmentRecord,
  updateOrderRecord,
  upsertOrderQuote,
  upsertPayment
} from "./orders.repository";

interface CreateOrderItemPayload {
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

interface CreateOrderPayload {
  customerName: string;
  customerPhone: string;
  depositorName?: string | null;
  purchaseUnit: (typeof purchaseUnits)[number];
  requestedDate?: string | null;
  requestedTimeSlot?: string | null;
  requestedAtNote?: string | null;
  fulfillmentType: (typeof fulfillmentTypes)[number];
  fulfillmentSubtype?: (typeof parcelSubtypes)[number] | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  postalCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  entrancePassword?: string | null;
  customerRequest?: string | null;
  isReservation: boolean;
  reservationTargetDate?: string | null;
  itemHoldRequestNote?: string | null;
  items: CreateOrderItemPayload[];
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("요청 본문이 올바르지 않습니다.");
  }
  return payload as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requiredString(value: unknown, fieldName: string, message: string): string {
  const parsed = optionalString(value);
  if (!parsed) {
    throw validationError("필수 항목이 누락되었습니다.", {
      [fieldName]: message
    });
  }
  return parsed;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw validationError("숫자 형식이 올바르지 않습니다.", {
      [fieldName]: "숫자 값을 입력해주세요."
    });
  }
  return value;
}

function requiredNumber(value: unknown, fieldName: string, message: string): number {
  const parsed = optionalNumber(value, fieldName);
  if (parsed === undefined) {
    throw validationError("필수 항목이 누락되었습니다.", {
      [fieldName]: message
    });
  }
  return parsed;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalDate(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = optionalString(value);
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw validationError("날짜 형식이 올바르지 않습니다.", {
      [fieldName]: "YYYY-MM-DD 형식으로 입력해주세요."
    });
  }
  return parsed;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return optionalString(value);
}

function expectEnum<T extends readonly string[]>(
  value: unknown,
  options: T,
  fieldName: string,
  message: string
): T[number] {
  const parsed = requiredString(value, fieldName, message);
  if (!options.includes(parsed as T[number])) {
    throw validationError("선택값이 올바르지 않습니다.", {
      [fieldName]: message
    });
  }
  return parsed as T[number];
}

function buildOrderNo(): string {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul"
  })
    .format(new Date())
    .replaceAll("-", "");

  return `OB-${datePart}-${Date.now().toString().slice(-6)}`;
}

function getInitialFulfillmentStatus(fulfillmentType: (typeof fulfillmentTypes)[number]) {
  switch (fulfillmentType) {
    case "pickup":
      return "pickup_waiting";
    case "quick":
      return "quick_waiting";
    case "parcel":
      return "parcel_waiting";
  }
}

function getNextStepMessage(order: OrderRecord, finalAmount?: string | null): string {
  if (!finalAmount) {
    return "최종 금액 확정 후 입금 안내 예정입니다.";
  }
  if (order.payment_status === "manual_confirmed" || order.payment_status === "auto_confirmed") {
    return "입금 확인이 완료되어 손질 및 출고 준비 중입니다.";
  }
  if (order.payment_status === "review_required") {
    return "입금 확인 검토 중입니다. 확인 후 안내드리겠습니다.";
  }
  return `최종 금액 ${finalAmount}원 확인 후 안내된 계좌로 입금해주세요.`;
}

function normalizeCreateOrderPayload(payload: unknown): CreateOrderPayload {
  const data = asRecord(payload);
  const purchaseUnit = expectEnum(
    data.purchase_unit,
    purchaseUnits,
    "purchase_unit",
    "whole 또는 half_request 중 하나를 선택해주세요."
  );
  const fulfillmentType = expectEnum(
    data.fulfillment_type,
    fulfillmentTypes,
    "fulfillment_type",
    "pickup, quick, parcel 중 하나를 선택해주세요."
  );
  const fulfillmentSubtype =
    fulfillmentType === "parcel"
      ? expectEnum(
          data.fulfillment_subtype,
          parcelSubtypes,
          "fulfillment_subtype",
          "parcel_standard, parcel_same_day, parcel_bus 중 하나를 선택해주세요."
        )
      : null;

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw validationError("주문 품목이 필요합니다.", {
      items: "최소 1개 이상의 주문 품목을 입력해주세요."
    });
  }

  const items = data.items.map((raw, index) => {
    const item = asRecord(raw);
    const requestedCutType = item.requested_cut_type
      ? expectEnum(
          item.requested_cut_type,
          cutTypes,
          `items.${index}.requested_cut_type`,
          "손질 유형이 올바르지 않습니다."
        )
      : undefined;

    if (fulfillmentType === "parcel" && requestedCutType === "sashimi") {
      throw new AppError(
        "UNSUPPORTED_FULFILLMENT_COMBINATION",
        400,
        "택배 주문에서는 회 손질을 직접 접수할 수 없습니다.",
        {
          fulfillment_type: "회 수령은 픽업 또는 퀵을 선택해주세요."
        }
      );
    }

    return {
      itemName: requiredString(item.item_name, `items.${index}.item_name`, "품목명을 입력해주세요."),
      originLabel: asNullableString(item.origin_label) ?? null,
      sizeBand: asNullableString(item.size_band) ?? null,
      quantity: requiredNumber(item.quantity, `items.${index}.quantity`, "수량을 입력해주세요."),
      unitLabel: optionalString(item.unit_label) ?? "kg",
      requestedCutType: requestedCutType ?? null,
      packingOption: asNullableString(item.packing_option) ?? null,
      unitPrice: optionalNumber(item.unit_price, `items.${index}.unit_price`) ?? null,
      estimatedTotal: optionalNumber(item.estimated_total, `items.${index}.estimated_total`) ?? null
    };
  });

  const receiverName = asNullableString(data.receiver_name) ?? null;
  const receiverPhone = asNullableString(data.receiver_phone) ?? null;
  const postalCode = asNullableString(data.postal_code) ?? null;
  const addressLine1 = asNullableString(data.address_line1) ?? null;

  if ((fulfillmentType === "quick" || fulfillmentType === "parcel") && (!receiverName || !receiverPhone)) {
    throw validationError("수령인 정보가 필요합니다.", {
      receiver_name: receiverName ? "" : "수령인명을 입력해주세요.",
      receiver_phone: receiverPhone ? "" : "수령인 연락처를 입력해주세요."
    });
  }

  if (fulfillmentType === "parcel" && (!postalCode || !addressLine1)) {
    throw validationError("택배 수령지 정보가 필요합니다.", {
      postal_code: postalCode ? "" : "우편번호를 입력해주세요.",
      address_line1: addressLine1 ? "" : "기본 주소를 입력해주세요."
    });
  }

  return {
    customerName: requiredString(data.customer_name, "customer_name", "주문자명을 입력해주세요."),
    customerPhone: requiredString(data.customer_phone, "customer_phone", "주문자 연락처를 입력해주세요."),
    depositorName: asNullableString(data.depositor_name) ?? null,
    purchaseUnit,
    requestedDate: optionalDate(data.requested_date, "requested_date") ?? null,
    requestedTimeSlot: asNullableString(data.requested_time_slot) ?? null,
    requestedAtNote: asNullableString(data.requested_at_note) ?? null,
    fulfillmentType,
    fulfillmentSubtype,
    receiverName,
    receiverPhone,
    postalCode,
    addressLine1,
    addressLine2: asNullableString(data.address_line2) ?? null,
    entrancePassword: asNullableString(data.entrance_password) ?? null,
    customerRequest: asNullableString(data.customer_request) ?? null,
    isReservation: optionalBoolean(data.is_reservation) ?? false,
    reservationTargetDate: optionalDate(data.reservation_target_date, "reservation_target_date") ?? null,
    itemHoldRequestNote: asNullableString(data.item_hold_request_note) ?? null,
    items
  };
}

async function requireOrder(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order) {
    throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
  }
  return order;
}

export async function getStoreInfo() {
  const store = await getDefaultStore();
  return {
    name: store.name,
    phones: [store.phone_primary, store.phone_secondary].filter(Boolean),
    bank_guide: {
      bank_name: store.bank_name ?? env.storeBankName ?? null,
      bank_account: store.bank_account ?? env.storeBankAccount ?? null,
      bank_holder: store.bank_holder ?? env.storeBankHolder ?? null
    },
    address: {
      line1: store.address_line1 ?? env.storeAddressLine1 ?? null,
      line2: store.address_line2 ?? env.storeAddressLine2 ?? null
    },
    business_hours_note: store.business_hours_note ?? env.storeBusinessHoursNote ?? null
  };
}

export async function createPublicOrder(payload: unknown) {
  const input = normalizeCreateOrderPayload(payload);
  const store = await getDefaultStore();
  const orderNo = buildOrderNo();
  const publicToken = randomUUID();
  const fulfillmentStatus = getInitialFulfillmentStatus(input.fulfillmentType);
  const matchStatus = input.purchaseUnit === "half_request" ? "matching_waiting" : "match_not_needed";

  return withTransaction(async (client) => {
    const order = await createOrderRecord(
      {
        storeId: store.id,
        orderNo,
        publicToken,
        orderStatus: "pricing_pending",
        pricingStatus: "quote_pending",
        paymentStatus: "unpaid",
        fulfillmentType: input.fulfillmentType,
        fulfillmentSubtype: input.fulfillmentSubtype,
        fulfillmentStatus,
        purchaseUnit: input.purchaseUnit,
        matchStatus,
        requestedDate: input.requestedDate,
        requestedTimeSlot: input.requestedTimeSlot,
        requestedAtNote: input.requestedAtNote,
        isReservation: input.isReservation,
        reservationTargetDate: input.reservationTargetDate,
        itemHoldRequestNote: input.itemHoldRequestNote,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        depositorName: input.depositorName,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        postalCode: input.postalCode,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        entrancePassword: input.entrancePassword,
        customerRequest: input.customerRequest
      },
      client
    );

    await createOrderItems(
      input.items.map((item) => ({
        orderId: order.id,
        ...item
      })),
      client
    );

    await createFulfillmentRecord(
      {
        orderId: order.id,
        fulfillmentType: input.fulfillmentType,
        fulfillmentSubtype: input.fulfillmentSubtype,
        fulfillmentStatus
      },
      client
    );

    await insertOrderStatusLog({ orderId: order.id, statusGroup: "order", toStatus: order.order_status, reason: "주문서 제출" }, client);
    await insertOrderStatusLog({ orderId: order.id, statusGroup: "pricing", toStatus: order.pricing_status, reason: "초기 견적 대기" }, client);
    await insertOrderStatusLog({ orderId: order.id, statusGroup: "payment", toStatus: order.payment_status, reason: "초기 미입금 상태" }, client);
    await insertOrderStatusLog({ orderId: order.id, statusGroup: "fulfillment", toStatus: fulfillmentStatus, reason: "초기 수령 방식 설정" }, client);
    if (matchStatus !== "match_not_needed") {
      await insertOrderStatusLog({ orderId: order.id, statusGroup: "match", toStatus: matchStatus, reason: "반절 주문 접수" }, client);
    }

    return {
      order_id: order.id,
      order_no: order.order_no,
      public_token: order.public_token,
      order_status: order.order_status,
      pricing_status: order.pricing_status,
      payment_status: order.payment_status
    };
  });
}

export async function getPublicOrder(publicToken: string) {
  const order = await getOrderByPublicToken(publicToken);
  if (!order) {
    throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
  }

  const store = await getDefaultStore();
  const quote = await getOrderQuote(order.id);
  return {
    public_token: order.public_token,
    order_no: order.order_no,
    order_status: order.order_status,
    pricing_status: order.pricing_status,
    payment_status: order.payment_status,
    fulfillment_status: order.fulfillment_status,
    quoted_amount: quote?.final_amount ?? null,
    bank_guide: {
      bank_name: store.bank_name ?? env.storeBankName ?? null,
      bank_account: store.bank_account ?? env.storeBankAccount ?? null,
      bank_holder: store.bank_holder ?? env.storeBankHolder ?? null
    },
    next_step_message: getNextStepMessage(order, quote?.final_amount ?? null)
  };
}

export async function getOrderFormOptions() {
  const store = await getDefaultStore();
  const rules = await listProcessingRules(store.id);
  return {
    purchase_units: purchaseUnits,
    fulfillment_types: fulfillmentTypes,
    parcel_subtypes: parcelSubtypes,
    cut_types: cutTypes,
    processing_fee_rules: rules,
    store_id: store.id,
    warnings: [
      "일반택배는 회보다 오로시/필렛 수령을 권장합니다.",
      "반절 주문은 매칭 완료 후 최종 금액이 확정될 수 있습니다."
    ]
  };
}

export async function getAdminOrders(query: Record<string, unknown>) {
  const store = await getDefaultStore();
  const filters = {
    date: optionalString(query.date) ?? "",
    order_status: optionalString(query.order_status) ?? "",
    pricing_status: optionalString(query.pricing_status) ?? "",
    payment_status: optionalString(query.payment_status) ?? "",
    fulfillment_status: optionalString(query.fulfillment_status) ?? "",
    match_status: optionalString(query.match_status) ?? "",
    search: optionalString(query.search) ?? "",
    is_reservation: optionalString(query.is_reservation) ?? ""
  };

  return {
    filters: {
      date: filters.date || null,
      order_status: filters.order_status || null,
      pricing_status: filters.pricing_status || null,
      payment_status: filters.payment_status || null,
      fulfillment_status: filters.fulfillment_status || null,
      match_status: filters.match_status || null,
      search: filters.search || null,
      is_reservation: filters.is_reservation || null
    },
    orders: await listOrders(store.id, filters)
  };
}

export async function getAdminOrderDetail(orderId: string) {
  const order = await requireOrder(orderId);
  const [items, quote, payment, fulfillment, statusLogs] = await Promise.all([
    getOrderItems(order.id),
    getOrderQuote(order.id),
    getPayment(order.id),
    getFulfillment(order.id),
    getOrderStatusLogs(order.id)
  ]);

  return {
    ...order,
    items,
    quote,
    payment,
    fulfillment,
    status_logs: statusLogs
  };
}

export async function patchAdminOrder(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  await requireOrder(orderId);

  const updates: Record<string, string | boolean | null> = {};
  const requestedDate = optionalDate(data.requested_date, "requested_date");
  if (requestedDate !== undefined) updates.requested_date = requestedDate;
  const requestedTimeSlot = asNullableString(data.requested_time_slot);
  if (requestedTimeSlot !== undefined) updates.requested_time_slot = requestedTimeSlot;
  const receiverName = asNullableString(data.receiver_name);
  if (receiverName !== undefined) updates.receiver_name = receiverName;
  const receiverPhone = asNullableString(data.receiver_phone);
  if (receiverPhone !== undefined) updates.receiver_phone = receiverPhone;
  const addressLine1 = asNullableString(data.address_line1);
  if (addressLine1 !== undefined) updates.address_line1 = addressLine1;
  const addressLine2 = asNullableString(data.address_line2);
  if (addressLine2 !== undefined) updates.address_line2 = addressLine2;
  const customerRequest = asNullableString(data.customer_request);
  if (customerRequest !== undefined) updates.customer_request = customerRequest;
  const internalNote = asNullableString(data.internal_note);
  if (internalNote !== undefined) updates.internal_note = internalNote;

  const updated = await updateOrderRecord(orderId, updates);
  if (!updated) {
    throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
  }
  return updated;
}

interface QuotePayload {
  itemSubtotal: number;
  processingFeeTotal: number;
  deliveryFeeTotal: number;
  discountTotal: number;
  finalAmount: number;
  receiptTypeNote?: string | null;
  paymentMethodNote?: string | null;
  quoteNote?: string | null;
}

function normalizeQuotePayload(payload: unknown): QuotePayload {
  const data = asRecord(payload);
  return {
    itemSubtotal: requiredNumber(data.item_subtotal, "item_subtotal", "상품 금액을 입력해주세요."),
    processingFeeTotal: requiredNumber(data.processing_fee_total, "processing_fee_total", "손질비를 입력해주세요."),
    deliveryFeeTotal: requiredNumber(data.delivery_fee_total, "delivery_fee_total", "배송비를 입력해주세요."),
    discountTotal: requiredNumber(data.discount_total, "discount_total", "할인 금액을 입력해주세요."),
    finalAmount: requiredNumber(data.final_amount, "final_amount", "최종 금액을 입력해주세요."),
    receiptTypeNote: asNullableString(data.receipt_type_note) ?? null,
    paymentMethodNote: asNullableString(data.payment_method_note) ?? null,
    quoteNote: asNullableString(data.quote_note) ?? null
  };
}

export async function changeOrderStatus(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  const statusGroup = expectEnum(
    data.status_group,
    Object.keys(statusGroups) as Array<keyof typeof statusGroups>,
    "status_group",
    "status_group은 order, pricing, payment, fulfillment, match 중 하나여야 합니다."
  );
  const toStatus = expectEnum(data.to_status, statusGroups[statusGroup], "to_status", "상태값이 올바르지 않습니다.");
  const reason = asNullableString(data.reason) ?? null;
  const order = await requireOrder(orderId);
  const currentStatus = order[`${statusGroup}_status` as keyof OrderRecord];

  if (statusGroup === "order" && toStatus === "completed") {
    const paid = order.payment_status === "manual_confirmed" || order.payment_status === "auto_confirmed";
    if (!paid) {
      throw new AppError("PAYMENT_NOT_CONFIRMED", 400, "미입금 상태에서는 주문 완료 처리할 수 없습니다.");
    }
  }

  return withTransaction(async (client) => {
    if (statusGroup === "fulfillment") {
      await updateFulfillmentRecord(orderId, { fulfillment_status: toStatus }, client);
    }

    if (statusGroup === "payment") {
      const quote = await getOrderQuote(orderId, client);
      const payment = await getPayment(orderId, client);
      const upserted = await upsertPayment(
        {
          orderId,
          expectedAmount: Number(quote?.final_amount ?? payment?.expected_amount ?? 0),
          paidAmount: Number(payment?.paid_amount ?? 0),
          paymentStatus: toStatus,
          confirmedByMode:
            toStatus === "manual_confirmed" || toStatus === "auto_confirmed"
              ? payment?.confirmed_by_mode ?? "manual"
              : null,
          confirmedAt:
            toStatus === "manual_confirmed" || toStatus === "auto_confirmed"
              ? payment?.confirmed_at ?? new Date().toISOString()
              : null,
          note: payment?.note ?? reason
        },
        client
      );
      await createPaymentEvent(
        {
          paymentId: upserted.id,
          fromStatus: payment?.payment_status ?? order.payment_status,
          toStatus,
          reason
        },
        client
      );
    }

    const updatedOrder = await updateOrderRecord(orderId, { [`${statusGroup}_status`]: toStatus }, client);
    if (!updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    await insertOrderStatusLog(
      {
        orderId,
        statusGroup,
        fromStatus: typeof currentStatus === "string" ? currentStatus : null,
        toStatus,
        reason
      },
      client
    );

    return {
      id: orderId,
      status_change: {
        status_group: statusGroup,
        from_status: currentStatus,
        to_status: toStatus,
        reason
      },
      order: updatedOrder
    };
  });
}

export async function quoteOrder(orderId: string, payload: unknown) {
  const input = normalizeQuotePayload(payload);
  const current = await requireOrder(orderId);

  return withTransaction(async (client) => {
    const previousQuote = await getOrderQuote(orderId, client);
    const previousPayment = await getPayment(orderId, client);
    const quote = await upsertOrderQuote(
      {
        orderId,
        itemSubtotal: input.itemSubtotal,
        processingFeeTotal: input.processingFeeTotal,
        deliveryFeeTotal: input.deliveryFeeTotal,
        discountTotal: input.discountTotal,
        finalAmount: input.finalAmount,
        receiptTypeNote: input.receiptTypeNote,
        paymentMethodNote: input.paymentMethodNote,
        quoteNote: input.quoteNote
      },
      client
    );

    const pricingStatus = previousQuote ? "requoted" : "quoted";
    const payment = await upsertPayment(
      {
        orderId,
        expectedAmount: input.finalAmount,
        paidAmount: Number(previousPayment?.paid_amount ?? 0),
        paymentStatus: previousPayment?.payment_status ?? "unpaid",
        confirmedByMode: previousPayment?.confirmed_by_mode ?? null,
        confirmedAt: previousPayment?.confirmed_at ?? null,
        note: previousPayment?.note ?? null
      },
      client
    );

    const updatedOrder = await updateOrderRecord(
      orderId,
      {
        pricing_status: pricingStatus,
        order_status: "waiting_payment",
        payment_status: payment.payment_status
      },
      client
    );
    if (!updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    await insertOrderStatusLog(
      {
        orderId,
        statusGroup: "pricing",
        fromStatus: current.pricing_status,
        toStatus: pricingStatus,
        reason: "최종 금액 확정"
      },
      client
    );
    if (current.order_status !== "waiting_payment") {
      await insertOrderStatusLog(
        {
          orderId,
          statusGroup: "order",
          fromStatus: current.order_status,
          toStatus: "waiting_payment",
          reason: "입금 대기 전환"
        },
        client
      );
    }

    return {
      id: orderId,
      quote,
      pricing_status: pricingStatus,
      order_status: "waiting_payment"
    };
  });
}

export async function manualConfirmPayment(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  const confirmedAmount = requiredNumber(data.confirmed_amount, "confirmed_amount", "확인 금액을 입력해주세요.");
  const note = asNullableString(data.note) ?? null;

  return withTransaction(async (client) => {
    const order = await getOrderById(orderId, client);
    if (!order) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }
    const quote = await getOrderQuote(orderId, client);
    if (!quote) {
      throw new AppError("QUOTE_REQUIRED", 400, "최종 금액 확정 후 입금 확인이 가능합니다.");
    }
    const previousPayment = await getPayment(orderId, client);
    const expectedAmount = Number(quote.final_amount);
    let paymentStatus: (typeof paymentStatuses)[number] = "manual_confirmed";
    let nextOrderStatus = "ready_for_prep";

    if (confirmedAmount < expectedAmount) {
      paymentStatus = "partial_paid";
      nextOrderStatus = "waiting_payment";
    } else if (confirmedAmount > expectedAmount) {
      paymentStatus = "over_paid";
    }

    const payment = await upsertPayment(
      {
        orderId,
        expectedAmount,
        paidAmount: confirmedAmount,
        paymentStatus,
        confirmedByMode: "manual",
        confirmedAt: new Date().toISOString(),
        note
      },
      client
    );

    await createPaymentEvent(
      {
        paymentId: payment.id,
        fromStatus: previousPayment?.payment_status ?? order.payment_status,
        toStatus: paymentStatus,
        reason: note ?? "수동 입금 확인"
      },
      client
    );

    const updatedOrder = await updateOrderRecord(orderId, { payment_status: paymentStatus, order_status: nextOrderStatus }, client);
    if (!updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    await insertOrderStatusLog(
      {
        orderId,
        statusGroup: "payment",
        fromStatus: order.payment_status,
        toStatus: paymentStatus,
        reason: note ?? "수동 입금 확인"
      },
      client
    );
    if (order.order_status !== nextOrderStatus) {
      await insertOrderStatusLog(
        {
          orderId,
          statusGroup: "order",
          fromStatus: order.order_status,
          toStatus: nextOrderStatus,
          reason: "입금 확인 결과 반영"
        },
        client
      );
    }

    return {
      id: orderId,
      payment_status: paymentStatus,
      payload: {
        confirmed_amount: confirmedAmount,
        note
      }
    };
  });
}

export async function markPaymentReview(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  const reason = requiredString(data.reason, "reason", "검토 사유를 입력해주세요.");
  const note = asNullableString(data.note) ?? null;

  return withTransaction(async (client) => {
    const order = await getOrderById(orderId, client);
    if (!order) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }
    const quote = await getOrderQuote(orderId, client);
    const previousPayment = await getPayment(orderId, client);
    const payment = await upsertPayment(
      {
        orderId,
        expectedAmount: Number(quote?.final_amount ?? previousPayment?.expected_amount ?? 0),
        paidAmount: Number(previousPayment?.paid_amount ?? 0),
        paymentStatus: "review_required",
        confirmedByMode: null,
        confirmedAt: null,
        note: note ?? reason
      },
      client
    );

    await createPaymentEvent(
      {
        paymentId: payment.id,
        fromStatus: previousPayment?.payment_status ?? order.payment_status,
        toStatus: "review_required",
        reason
      },
      client
    );

    const updatedOrder = await updateOrderRecord(orderId, { payment_status: "review_required", order_status: "payment_review" }, client);
    if (!updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    await insertOrderStatusLog({ orderId, statusGroup: "payment", fromStatus: order.payment_status, toStatus: "review_required", reason }, client);
    await insertOrderStatusLog({ orderId, statusGroup: "order", fromStatus: order.order_status, toStatus: "payment_review", reason }, client);

    return {
      id: orderId,
      payment_status: "review_required",
      payload: {
        reason,
        note
      }
    };
  });
}

export async function patchOrderFulfillment(orderId: string, payload: unknown) {
  const data = asRecord(payload);

  return withTransaction(async (client) => {
    const order = await getOrderById(orderId, client);
    if (!order) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    const fulfillmentType =
      data.fulfillment_type === undefined
        ? order.fulfillment_type
        : expectEnum(data.fulfillment_type, fulfillmentTypes, "fulfillment_type", "수령 방식이 올바르지 않습니다.");
    const fulfillmentSubtype =
      data.fulfillment_subtype === undefined
        ? order.fulfillment_subtype
        : data.fulfillment_subtype === null
          ? null
          : optionalString(data.fulfillment_subtype) ?? null;
    const fulfillmentStatus =
      data.fulfillment_status === undefined
        ? order.fulfillment_status
        : expectEnum(data.fulfillment_status, fulfillmentStatuses, "fulfillment_status", "출고 상태가 올바르지 않습니다.");

    const fulfillmentUpdates: Record<string, string | null> = {
      fulfillment_type: fulfillmentType,
      fulfillment_subtype: fulfillmentSubtype ?? null,
      fulfillment_status: fulfillmentStatus
    };
    if (data.quick_dispatch_note !== undefined) {
      fulfillmentUpdates.quick_dispatch_note = asNullableString(data.quick_dispatch_note) ?? null;
    }
    if (data.parcel_tracking_no !== undefined) {
      fulfillmentUpdates.parcel_tracking_no = asNullableString(data.parcel_tracking_no) ?? null;
    }
    if (data.packing_note !== undefined) {
      fulfillmentUpdates.packing_note = asNullableString(data.packing_note) ?? null;
    }

    const updatedFulfillment = await updateFulfillmentRecord(orderId, fulfillmentUpdates, client);
    const updatedOrder = await updateOrderRecord(
      orderId,
      {
        fulfillment_type: fulfillmentType,
        fulfillment_subtype: fulfillmentSubtype ?? null,
        fulfillment_status: fulfillmentStatus
      },
      client
    );
    if (!updatedFulfillment || !updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    if (order.fulfillment_status !== fulfillmentStatus) {
      await insertOrderStatusLog(
        {
          orderId,
          statusGroup: "fulfillment",
          fromStatus: order.fulfillment_status,
          toStatus: fulfillmentStatus,
          reason: "출고 정보 수정"
        },
        client
      );
    }

    return {
      id: orderId,
      fulfillment: updatedFulfillment
    };
  });
}

async function completeFulfillment(orderId: string, fulfillmentStatus: string, note?: string | null) {
  return withTransaction(async (client) => {
    const order = await getOrderById(orderId, client);
    if (!order) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }
    if (
      order.payment_status !== "manual_confirmed" &&
      order.payment_status !== "auto_confirmed" &&
      order.payment_status !== "over_paid"
    ) {
      throw new AppError("PAYMENT_NOT_CONFIRMED", 400, "입금 확인 전에는 출고 완료 처리할 수 없습니다.");
    }

    await updateFulfillmentRecord(
      orderId,
      {
        fulfillment_status: fulfillmentStatus,
        handed_off_at: new Date().toISOString()
      },
      client
    );

    const updatedOrder = await updateOrderRecord(
      orderId,
      {
        fulfillment_status: fulfillmentStatus,
        order_status: "completed"
      },
      client
    );
    if (!updatedOrder) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }

    await insertOrderStatusLog(
      {
        orderId,
        statusGroup: "fulfillment",
        fromStatus: order.fulfillment_status,
        toStatus: fulfillmentStatus,
        reason: note ?? "출고 완료"
      },
      client
    );
    await insertOrderStatusLog(
      {
        orderId,
        statusGroup: "order",
        fromStatus: order.order_status,
        toStatus: "completed",
        reason: note ?? "인계 완료"
      },
      client
    );
  });
}

export async function markPickupDone(orderId: string, payload: unknown) {
  const data = payload ? asRecord(payload) : {};
  const note = asNullableString(data.note) ?? null;
  await completeFulfillment(orderId, "pickup_done", note);
  return {
    id: orderId,
    fulfillment_status: "pickup_done",
    payload: { note }
  };
}

export async function markQuickSent(orderId: string, payload: unknown) {
  const data = payload ? asRecord(payload) : {};
  const note = asNullableString(data.note) ?? null;
  await completeFulfillment(orderId, "quick_sent", note);
  return {
    id: orderId,
    fulfillment_status: "quick_sent",
    payload: { note }
  };
}

export async function markParcelSent(orderId: string, payload: unknown) {
  const data = payload ? asRecord(payload) : {};
  const note = asNullableString(data.note) ?? null;
  await completeFulfillment(orderId, "parcel_sent", note);
  return {
    id: orderId,
    fulfillment_status: "parcel_sent",
    payload: { note }
  };
}

export async function patchReservation(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  await requireOrder(orderId);

  const updated = await updateOrderRecord(orderId, {
    reservation_target_date: optionalDate(data.reservation_target_date, "reservation_target_date") ?? null,
    item_hold_request_note: asNullableString(data.item_hold_request_note) ?? null,
    is_reservation: optionalBoolean(data.is_reservation) ?? true
  });
  if (!updated) {
    throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
  }

  return {
    id: orderId,
    reservation: {
      is_reservation: updated.is_reservation,
      reservation_target_date: updated.reservation_target_date,
      item_hold_request_note: updated.item_hold_request_note
    }
  };
}

export async function getOrderLogs(orderId: string) {
  await requireOrder(orderId);
  return {
    id: orderId,
    logs: await getOrderStatusLogs(orderId)
  };
}

export async function getFulfillmentQueue(query: Record<string, unknown>) {
  const store = await getDefaultStore();
  const filters = {
    fulfillment_type: optionalString(query.fulfillment_type) ?? "",
    fulfillment_status: optionalString(query.fulfillment_status) ?? "",
    date: optionalString(query.date) ?? ""
  };

  return {
    filters: {
      fulfillment_type: filters.fulfillment_type || null,
      fulfillment_status: filters.fulfillment_status || null,
      date: filters.date || null
    },
    fulfillments: await listFulfillments(store.id, filters)
  };
}

export async function validateStatusCatalogs() {
  return {
    order_statuses: orderStatuses,
    pricing_statuses: pricingStatuses,
    payment_statuses: paymentStatuses,
    fulfillment_statuses: fulfillmentStatuses,
    match_statuses: matchStatuses
  };
}
