import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import {
  addPriceBoardItem,
  createOrUpdatePriceBoard,
  getAdminPriceBoards,
  patchPriceBoardItem,
  publishPriceBoard
} from "./price-board.service";

export const priceBoardRouter = Router();

priceBoardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getAdminPriceBoards(typeof req.query.date === "string" ? req.query.date : undefined));
  })
);

priceBoardRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, { batch: await createOrUpdatePriceBoard(req.body) }, 201);
  })
);

priceBoardRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    ok(res, { item: await addPriceBoardItem(req.body) }, 201);
  })
);

priceBoardRouter.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    ok(res, { item: await patchPriceBoardItem(req.params.itemId, req.body) });
  })
);

priceBoardRouter.post(
  "/:batchId/publish",
  asyncHandler(async (req, res) => {
    ok(res, await publishPriceBoard(req.params.batchId));
  })
);
