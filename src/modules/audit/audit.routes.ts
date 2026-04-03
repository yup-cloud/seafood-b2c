import { Router } from "express";
import { ok } from "../../lib/http";

export const auditLogsRouter = Router();

auditLogsRouter.get("/", (req, res) => {
  ok(res, {
    filters: {
      target_type: req.query.target_type ?? null,
      target_id: req.query.target_id ?? null,
      date_from: req.query.date_from ?? null,
      date_to: req.query.date_to ?? null
    },
    logs: []
  });
});
