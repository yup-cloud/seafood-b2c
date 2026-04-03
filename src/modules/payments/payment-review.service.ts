import { withTransaction } from "../../lib/db";
import { validationError } from "../../lib/errors";
import { listBankTransactions } from "../bank-transactions/bank-transactions.repository";
import { confirmOrderWithTransaction } from "../bank-transactions/bank-transactions.service";
import {
  createPaymentEvent,
  getOrderById,
  getOrderQuote,
  getPayment,
  insertOrderStatusLog,
  listOrders,
  updateOrderRecord,
  upsertPayment
} from "../orders/orders.repository";
import { getDefaultStore } from "../stores/stores.service";

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

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}

export async function getPaymentReviewQueue() {
  const store = await getDefaultStore();
  const orders = await listOrders(
    store.id,
    {
      date: "",
      order_status: "",
      pricing_status: "",
      payment_status: "review_required",
      fulfillment_status: "",
      match_status: "",
      search: "",
      is_reservation: ""
    }
  );
  const transactions = await listBankTransactions(store.id, { date_from: "", date_to: "", amount: "", matched: "false" });

  const reviewQueue = await Promise.all(
    orders.map(async (order) => {
      const payment = await getPayment(order.id);
      const candidates = transactions.filter((txn) => txn.amount === payment?.expected_amount);
      return {
        order_id: order.id,
        order_no: order.order_no,
        customer_name: order.customer_name,
        expected_amount: payment?.expected_amount ?? null,
        transaction_candidates: candidates,
        review_reason: "동일 금액 또는 입금자명 확인 필요"
      };
    })
  );

  return { review_queue: reviewQueue };
}

export async function linkPaymentReview(orderId: string, payload: unknown) {
  const data = asRecord(payload);
  const bankTransactionId = optionalString(data.bank_transaction_id);
  if (!bankTransactionId) {
    throw validationError("거래내역을 선택해주세요.", {
      bank_transaction_id: "연결할 거래내역 ID가 필요합니다."
    });
  }

  return confirmOrderWithTransaction(orderId, bankTransactionId, optionalString(data.note) ?? null, "manual");
}

export async function runAutoMatch() {
  const store = await getDefaultStore();
  const candidateOrders = await listOrders(
    store.id,
    {
      date: "",
      order_status: "",
      pricing_status: "",
      payment_status: "",
      fulfillment_status: "",
      match_status: "",
      search: "",
      is_reservation: ""
    }
  );
  const transactions = await listBankTransactions(store.id, { date_from: "", date_to: "", amount: "", matched: "false" });

  let matchedCount = 0;
  let reviewRequiredCount = 0;

  for (const txn of transactions) {
    const matchingOrders: string[] = [];
    for (const order of candidateOrders) {
      if (order.payment_status !== "unpaid" && order.payment_status !== "review_required") {
        continue;
      }

      const payment = await getPayment(order.id);
      if (!payment || payment.expected_amount !== txn.amount) {
        continue;
      }

      const orderDetail = await getOrderById(order.id);
      const depositorMatches =
        !txn.depositor_name ||
        normalizeName(txn.depositor_name) === normalizeName(orderDetail?.depositor_name) ||
        normalizeName(txn.depositor_name) === normalizeName(orderDetail?.customer_name);

      if (depositorMatches) {
        matchingOrders.push(order.id);
      }
    }

    if (matchingOrders.length === 1) {
      await confirmOrderWithTransaction(matchingOrders[0], txn.id, "자동 대조 성공", "auto");
      matchedCount += 1;
    } else if (matchingOrders.length > 1) {
      reviewRequiredCount += matchingOrders.length;

      await withTransaction(async (client) => {
        for (const orderId of matchingOrders) {
          const order = await getOrderById(orderId, client);
          const quote = await getOrderQuote(orderId, client);
          const payment = await getPayment(orderId, client);
          if (!order || !payment) {
            continue;
          }

          await upsertPayment(
            {
              orderId,
              expectedAmount: Number(quote?.final_amount ?? payment.expected_amount),
              paidAmount: Number(payment.paid_amount),
              paymentStatus: "review_required",
              confirmedByMode: null,
              confirmedAt: null,
              note: "자동 대조 후보 중복"
            },
            client
          );
          await createPaymentEvent(
            {
              paymentId: payment.id,
              fromStatus: payment.payment_status,
              toStatus: "review_required",
              reason: "자동 대조 후보 중복"
            },
            client
          );
          await updateOrderRecord(orderId, { payment_status: "review_required", order_status: "payment_review" }, client);
          await insertOrderStatusLog(
            {
              orderId,
              statusGroup: "payment",
              fromStatus: order.payment_status,
              toStatus: "review_required",
              reason: "자동 대조 후보 중복"
            },
            client
          );
        }
      });
    }
  }

  return {
    matched_count: matchedCount,
    review_required_count: reviewRequiredCount
  };
}
