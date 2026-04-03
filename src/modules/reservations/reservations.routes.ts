import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import { getReservations } from "./reservations.service";

export const reservationsRouter = Router();

reservationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getReservations(req.query as Record<string, unknown>));
  })
);
