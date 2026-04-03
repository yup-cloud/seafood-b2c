import { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    data,
    meta: {
      request_id: res.locals.requestId
    }
  });
}

export function fail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>
): void {
  res.status(status).json({
    error: {
      code,
      message,
      fields
    }
  });
}
