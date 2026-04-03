import { Queryable, db } from "../../lib/db";

export interface BankTransactionRecord {
  id: string;
  store_id: string;
  provider_name: string | null;
  external_txn_id: string | null;
  transaction_at: string;
  depositor_name: string | null;
  amount: string;
  currency: string;
  raw_payload: unknown;
  imported_at: string;
  matched: boolean;
}

export interface CreateBankTransactionInput {
  storeId: string;
  providerName?: string | null;
  externalTxnId?: string | null;
  transactionAt: string;
  depositorName?: string | null;
  amount: number;
  currency?: string;
  rawPayload?: unknown;
}

export async function listBankTransactions(
  storeId: string,
  filters: Record<string, string>,
  executor: Queryable = db
): Promise<BankTransactionRecord[]> {
  const values: string[] = [storeId];
  const where = ["bt.store_id = $1"];

  if (filters.date_from) {
    values.push(filters.date_from);
    where.push(`bt.transaction_at >= $${values.length}::timestamptz`);
  }
  if (filters.date_to) {
    values.push(filters.date_to);
    where.push(`bt.transaction_at <= $${values.length}::timestamptz`);
  }
  if (filters.amount) {
    values.push(filters.amount);
    where.push(`bt.amount = $${values.length}::numeric`);
  }
  if (filters.matched === "true") {
    where.push("exists (select 1 from payment_matches pm where pm.bank_transaction_id = bt.id)");
  }
  if (filters.matched === "false") {
    where.push("not exists (select 1 from payment_matches pm where pm.bank_transaction_id = bt.id)");
  }

  const result = await executor.query<BankTransactionRecord>(
    `
      select
        bt.id,
        bt.store_id,
        bt.provider_name,
        bt.external_txn_id,
        bt.transaction_at::text,
        bt.depositor_name,
        bt.amount::text,
        bt.currency,
        bt.raw_payload,
        bt.imported_at::text,
        exists (select 1 from payment_matches pm where pm.bank_transaction_id = bt.id) as matched
      from bank_transactions bt
      where ${where.join(" and ")}
      order by bt.transaction_at desc
    `,
    values
  );

  return result.rows;
}

export async function createBankTransactions(
  items: CreateBankTransactionInput[],
  executor: Queryable = db
): Promise<BankTransactionRecord[]> {
  const created: BankTransactionRecord[] = [];
  for (const item of items) {
    const result = await executor.query<BankTransactionRecord>(
      `
        insert into bank_transactions (
          store_id,
          provider_name,
          external_txn_id,
          transaction_at,
          depositor_name,
          amount,
          currency,
          raw_payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning
          id,
          store_id,
          provider_name,
          external_txn_id,
          transaction_at::text,
          depositor_name,
          amount::text,
          currency,
          raw_payload,
          imported_at::text,
          false as matched
      `,
      [
        item.storeId,
        item.providerName ?? null,
        item.externalTxnId ?? null,
        item.transactionAt,
        item.depositorName ?? null,
        item.amount,
        item.currency ?? "KRW",
        item.rawPayload ?? null
      ]
    );
    created.push(result.rows[0]);
  }
  return created;
}

export async function getBankTransactionById(
  transactionId: string,
  executor: Queryable = db
): Promise<BankTransactionRecord | null> {
  const result = await executor.query<BankTransactionRecord>(
    `
      select
        bt.id,
        bt.store_id,
        bt.provider_name,
        bt.external_txn_id,
        bt.transaction_at::text,
        bt.depositor_name,
        bt.amount::text,
        bt.currency,
        bt.raw_payload,
        bt.imported_at::text,
        exists (select 1 from payment_matches pm where pm.bank_transaction_id = bt.id) as matched
      from bank_transactions bt
      where bt.id = $1
    `,
    [transactionId]
  );

  return result.rows[0] ?? null;
}

export interface PaymentMatchRecord {
  id: string;
  payment_id: string;
  bank_transaction_id: string;
  match_status: string;
  match_score: string | null;
  matched_by_mode: string;
  note: string | null;
  created_at: string;
}

export async function createPaymentMatch(
  input: {
    paymentId: string;
    bankTransactionId: string;
    matchStatus: string;
    matchScore?: number | null;
    matchedByMode: string;
    note?: string | null;
  },
  executor: Queryable = db
): Promise<PaymentMatchRecord> {
  const result = await executor.query<PaymentMatchRecord>(
    `
      insert into payment_matches (
        payment_id,
        bank_transaction_id,
        match_status,
        match_score,
        matched_by_mode,
        note
      )
      values ($1, $2, $3, $4, $5, $6)
      returning
        id,
        payment_id,
        bank_transaction_id,
        match_status,
        match_score::text,
        matched_by_mode,
        note,
        created_at::text
    `,
    [
      input.paymentId,
      input.bankTransactionId,
      input.matchStatus,
      input.matchScore ?? null,
      input.matchedByMode,
      input.note ?? null
    ]
  );

  return result.rows[0];
}

export async function hasConfirmedMatchForPaymentOrTransaction(
  paymentId: string,
  bankTransactionId: string,
  executor: Queryable = db
): Promise<boolean> {
  const result = await executor.query<{ exists_flag: boolean }>(
    `
      select exists(
        select 1
        from payment_matches
        where payment_id = $1
           or bank_transaction_id = $2
      ) as exists_flag
    `,
    [paymentId, bankTransactionId]
  );

  return result.rows[0]?.exists_flag ?? false;
}
