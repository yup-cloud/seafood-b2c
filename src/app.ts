import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { healthcheckDatabase } from "./lib/db";
import { errorHandler } from "./lib/errors";
import { fail, ok } from "./lib/http";
import { adminRouter } from "./routes/admin";
import { publicRoutes } from "./routes/public";

export function createApp() {
  const app = express();
  const webDistDir = path.resolve(__dirname, "../web/dist");
  const webIndexPath = path.join(webDistDir, "index.html");
  const hasBuiltWebApp = existsSync(webIndexPath);

  // IP 기반 HTTP 데모 환경에서는 helmet 기본 CSP/COOP 헤더가
  // 자산 요청을 HTTPS로 올리거나 브라우저 경고를 유발할 수 있다.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false
    })
  );
  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    next();
  });

  app.get("/api/v1/health", async (_req, res) => {
    const dbOk = await healthcheckDatabase();
    ok(res, {
      status: "ok",
      database: dbOk ? "reachable" : "unavailable"
    });
  });

  app.use("/api/v1/public", publicRoutes);
  app.use("/api/v1/admin", adminRouter);

  if (hasBuiltWebApp) {
    app.use(express.static(webDistDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }

      res.sendFile(webIndexPath);
    });
  }

  app.use((_req, res) => {
    fail(res, "NOT_FOUND", "요청한 경로를 찾을 수 없습니다.", 404);
  });

  app.use(errorHandler);

  return app;
}
