import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import { getBankTransactionList, importBankTransactions } from "./bank-transactions.service";

export const bankTransactionsRouter = Router();

bankTransactionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getBankTransactionList(req.query as Record<string, unknown>));
  })
);

bankTransactionsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    ok(res, await importBankTransactions(req.body), 202);
  })
);
