import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import { getTodayPriceBoard } from "../price-board/price-board.service";
import {
  createPublicOrder,
  getOrderFormOptions,
  getPublicOrder,
  getPublicOrderByOrderNo,
  getStoreInfo
} from "../orders/orders.service";

export const publicRouter = Router();

publicRouter.get(
  "/store",
  asyncHandler(async (_req, res) => {
    ok(res, await getStoreInfo());
  })
);

publicRouter.get(
  "/price-board/today",
  asyncHandler(async (req, res) => {
    ok(res, await getTodayPriceBoard(typeof req.query.date === "string" ? req.query.date : undefined));
  })
);

publicRouter.get(
  "/order-form/options",
  asyncHandler(async (_req, res) => {
    ok(res, await getOrderFormOptions());
  })
);

publicRouter.post(
  "/orders",
  asyncHandler(async (req, res) => {
    ok(res, await createPublicOrder(req.body), 201);
  })
);

publicRouter.get(
  "/orders/lookup/:orderNo",
  asyncHandler(async (req, res) => {
    ok(res, await getPublicOrderByOrderNo(req.params.orderNo));
  })
);

publicRouter.get(
  "/orders/:publicToken",
  asyncHandler(async (req, res) => {
    ok(res, await getPublicOrder(req.params.publicToken));
  })
);
