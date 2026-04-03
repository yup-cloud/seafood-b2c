import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import { getPaymentReviewQueue, linkPaymentReview, runAutoMatch } from "./payment-review.service";

export const paymentReviewRouter = Router();

paymentReviewRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    ok(res, await getPaymentReviewQueue());
  })
);

paymentReviewRouter.post(
  "/:orderId/link",
  asyncHandler(async (req, res) => {
    ok(res, await linkPaymentReview(req.params.orderId, req.body));
  })
);

paymentReviewRouter.post(
  "/run-auto-match",
  asyncHandler(async (_req, res) => {
    ok(res, await runAutoMatch());
  })
);
