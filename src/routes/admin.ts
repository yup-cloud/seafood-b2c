import { Router } from "express";
import { auditLogsRouter } from "../modules/audit/audit.routes";
import { bankTransactionsRouter } from "../modules/bank-transactions/bank-transactions.routes";
import { fulfillmentsRouter } from "../modules/fulfillments/fulfillments.routes";
import { matchingRouter } from "../modules/matching/matching.routes";
import { ordersRouter } from "../modules/orders/orders.routes";
import { paymentReviewRouter } from "../modules/payments/payment-review.routes";
import { priceBoardRouter } from "../modules/price-board/price-board.routes";
import { processingRulesRouter } from "../modules/processing-rules/processing-rules.routes";
import { reservationsRouter } from "../modules/reservations/reservations.routes";

export const adminRouter = Router();

adminRouter.use("/orders", ordersRouter);
adminRouter.use("/price-board", priceBoardRouter);
adminRouter.use("/processing-rules", processingRulesRouter);
adminRouter.use("/fulfillments", fulfillmentsRouter);
adminRouter.use("/matching", matchingRouter);
adminRouter.use("/payment-review", paymentReviewRouter);
adminRouter.use("/bank-transactions", bankTransactionsRouter);
adminRouter.use("/audit-logs", auditLogsRouter);
adminRouter.use("/reservations", reservationsRouter);
