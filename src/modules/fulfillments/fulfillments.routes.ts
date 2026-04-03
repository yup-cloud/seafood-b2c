import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import { getFulfillmentQueue } from "../orders/orders.service";

export const fulfillmentsRouter = Router();

fulfillmentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getFulfillmentQueue(req.query as Record<string, unknown>));
  })
);
