import { Router } from "express";
import { publicRouter } from "../modules/public/public.routes";

export const publicRoutes = Router();

publicRoutes.use(publicRouter);
