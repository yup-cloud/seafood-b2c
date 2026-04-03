import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { ok } from "../../lib/http";
import {
  createProcessingRuleFromPayload,
  getProcessingRules,
  updateProcessingRuleFromPayload
} from "./processing-rules.service";

export const processingRulesRouter = Router();

processingRulesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    ok(res, { rules: await getProcessingRules() });
  })
);

processingRulesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, { rule: await createProcessingRuleFromPayload(req.body) }, 201);
  })
);

processingRulesRouter.patch(
  "/:ruleId",
  asyncHandler(async (req, res) => {
    ok(res, { rule: await updateProcessingRuleFromPayload(req.params.ruleId, req.body) });
  })
);
