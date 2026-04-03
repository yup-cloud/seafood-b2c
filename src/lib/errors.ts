import { ErrorRequestHandler } from "express";
import { fail } from "./http";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function validationError(message: string, fields?: Record<string, string>): AppError {
  return new AppError("VALIDATION_ERROR", 400, message, fields);
}

export function notFoundError(code: string, message: string): AppError {
  return new AppError(code, 404, message);
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    fail(res, error.code, error.message, error.status, error.fields);
    return;
  }

  console.error("[error]", error);
  fail(res, "INTERNAL_SERVER_ERROR", "서버 처리 중 오류가 발생했습니다.", 500);
};
