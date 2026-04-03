import { withTransaction } from "../../lib/db";
import { notFoundError, validationError } from "../../lib/errors";
import { getPayment, getOrderById, insertOrderStatusLog, updateOrderRecord, upsertPayment, createPaymentEvent } from "../orders/orders.repository";
import { getDefaultStore } from "../stores/stores.service";
import {
  createBankTransactions,
  createPaymentMatch,
  getBankTransactionById,
  hasConfirmedMatchForPaymentOrTransaction,
  listBankTransactions
} from "./bank-transactions.repository";

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

function requiredNumber(value: unknown, fieldName: string, message: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw validationError("숫자 형식이 올바르지 않습니다.", {
      [fieldName]: message
    });
  }
  return value;
}

export async function getBankTransactionList(query: Record<string, unknown>) {
  const store = await getDefaultStore();
  const filters = {
    date_from: optionalString(query.date_from) ?? "",
    date_to: optionalString(query.date_to) ?? "",
    amount: optionalString(query.amount) ?? "",
    matched: optionalString(query.matched) ?? ""
  };

  return {
    filters: {
      date_from: filters.date_from || null,
      date_to: filters.date_to || null,
      amount: filters.amount || null,
      matched: filters.matched || null
    },
    transactions: await listBankTransactions(store.id, filters)
  };
}

export async function importBankTransactions(payload: unknown) {
  const store = await getDefaultStore();
  const data = Array.isArray(payload) ? { transactions: payload } : asRecord(payload);
  const rawTransactions = Array.isArray(data.transactions) ? data.transactions : [];

  if (rawTransactions.length === 0) {
    throw validationError("거래내역이 비어 있습니다.", {
      transactions: "최소 1건 이상의 거래내역이 필요합니다."
    });
  }

  const created = await createBankTransactions(
    rawTransactions.map((item, index) => {
      const txn = asRecord(item);
      return {
        storeId: store.id,
        providerName: optionalString(txn.provider_name) ?? null,
        externalTxnId: optionalString(txn.external_txn_id) ?? null,
        transactionAt: requiredString(txn.transaction_at, `transactions.${index}.transaction_at`, "거래 시각이 필요합니다."),
        depositorName: optionalString(txn.depositor_name) ?? null,
        amount: requiredNumber(txn.amount, `transactions.${index}.amount`, "금액은 숫자로 입력해주세요."),
        currency: optionalString(txn.currency) ?? "KRW",
        rawPayload: txn.raw_payload ?? txn
      };
    })
  );

  return {
    imported: true,
    count: created.length,
    transactions: created
  };
}

export async function confirmOrderWithTransaction(orderId: string, bankTransactionId: string, note?: string | null, matchedByMode = "manual") {
  return withTransaction(async (client) => {
    const order = await getOrderById(orderId, client);
    if (!order) {
      throw notFoundError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.");
    }
    const payment = await getPayment(orderId, client);
    if (!payment) {
      throw validationError("입금 예정 정보가 없습니다.", {
        order_id: "먼저 최종 금액을 확정해주세요."
      });
    }
    const transaction = await getBankTransactionById(bankTransactionId, client);
    if (!transaction) {
      throw notFoundError("BANK_TRANSACTION_NOT_FOUND", "거래내역을 찾을 수 없습니다.");
    }

    const alreadyMatched = await hasConfirmedMatchForPaymentOrTransaction(payment.id, transaction.id, client);
    if (alreadyMatched) {
      throw validationError("이미 연결된 거래입니다.", {
        bank_transaction_id: "이미 다른 주문 또는 결제와 연결되었습니다."
      });
    }

    await createPaymentMatch(
      {
        paymentId: payment.id,
        bankTransactionId: transaction.id,
        matchStatus: "confirmed",
        matchScore: 100,
        matchedByMode,
        note: note ?? null
      },
      client
    );

    const paymentStatus =
      Number(transaction.amount) >= Number(payment.expected_amount)
        ? matchedByMode === "auto"
          ? "auto_confirmed"
          : "manual_confirmed"
        : "partial_paid";
    const nextOrderStatus = paymentStatus === "partial_paid" ? "waiting_payment" : "ready_for_prep";

    await upsertPayment(
      {
        orderId,
        expectedAmount: Number(payment.expected_amount),
        paidAmount: Number(transaction.amount),
        paymentStatus,
        confirmedByMode: matchedByMode,
        confirmedAt: new Date().toISOString(),
        note: note ?? transaction.depositor_name ?? null
      },
      client
    );

    await createPaymentEvent(
      {
        paymentId: payment.id,
        fromStatus: payment.payment_status,
        toStatus: paymentStatus,
        reason: note ?? "거래내역 연결"
      },
      client
    );

    await updateOrderRecord(
      orderId,
      {
        payment_status: paymentStatus,
        order_status: nextOrderStatus
      },
      client
    );

    await insertOrderStatusLog(
      {
        orderId,
        statusGroup: "payment",
        fromStatus: order.payment_status,
        toStatus: paymentStatus,
        reason: note ?? "거래내역 연결"
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
      order_id: orderId,
      linked_transaction_id: bankTransactionId,
      payment_status: paymentStatus
    };
  });
}
