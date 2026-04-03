import { Router } from "express";
import { ok } from "../../lib/http";

export const matchingRouter = Router();

matchingRouter.get("/orders", (req, res) => {
  ok(res, {
    filters: {
      item_name: req.query.item_name ?? null,
      date: req.query.date ?? null,
      fulfillment_type: req.query.fulfillment_type ?? null
    },
    orders: []
  });
});

matchingRouter.get("/orders/:orderId/candidates", (req, res) => {
  ok(res, {
    order_id: req.params.orderId,
    candidates: []
  });
});

matchingRouter.post("/groups", (req, res) => {
  ok(
    res,
    {
      group: req.body,
      match_status: "matched"
    },
    201
  );
});

matchingRouter.post("/orders/:orderId/fail", (req, res) => {
  ok(res, {
    order_id: req.params.orderId,
    match_status: "match_failed",
    payload: req.body
  });
});
