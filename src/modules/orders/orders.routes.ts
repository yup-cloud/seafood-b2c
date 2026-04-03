import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import {
  changeOrderStatus,
  getAdminOrderDetail,
  getAdminOrders,
  getOrderLogs,
  manualConfirmPayment,
  markParcelSent,
  markPaymentReview,
  markPickupDone,
  markQuickSent,
  patchAdminOrder,
  patchOrderFulfillment,
  patchReservation,
  quoteOrder
} from "./orders.service";

export const ordersRouter = Router();

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getAdminOrders(req.query as Record<string, unknown>));
  })
);

ordersRouter.get(
  "/:orderId",
  asyncHandler(async (req, res) => {
    ok(res, await getAdminOrderDetail(req.params.orderId));
  })
);

ordersRouter.patch(
  "/:orderId",
  asyncHandler(async (req, res) => {
    ok(res, await patchAdminOrder(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/status",
  asyncHandler(async (req, res) => {
    ok(res, await changeOrderStatus(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/quote",
  asyncHandler(async (req, res) => {
    ok(res, await quoteOrder(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/payments/manual-confirm",
  asyncHandler(async (req, res) => {
    ok(res, await manualConfirmPayment(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/payments/review",
  asyncHandler(async (req, res) => {
    ok(res, await markPaymentReview(req.params.orderId, req.body));
  })
);

ordersRouter.patch(
  "/:orderId/fulfillment",
  asyncHandler(async (req, res) => {
    ok(res, await patchOrderFulfillment(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/fulfillment/pickup-done",
  asyncHandler(async (req, res) => {
    ok(res, await markPickupDone(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/fulfillment/quick-sent",
  asyncHandler(async (req, res) => {
    ok(res, await markQuickSent(req.params.orderId, req.body));
  })
);

ordersRouter.post(
  "/:orderId/fulfillment/parcel-sent",
  asyncHandler(async (req, res) => {
    ok(res, await markParcelSent(req.params.orderId, req.body));
  })
);

ordersRouter.patch(
  "/:orderId/reservation",
  asyncHandler(async (req, res) => {
    ok(res, await patchReservation(req.params.orderId, req.body));
  })
);

ordersRouter.get(
  "/:orderId/logs",
  asyncHandler(async (req, res) => {
    ok(res, await getOrderLogs(req.params.orderId));
  })
);
