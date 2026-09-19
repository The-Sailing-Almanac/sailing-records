import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ApiErrorResponse } from "@almanac/types";
import { logger } from "@stax/logger";

export function validate(schema: ZodSchema, target: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const response: ApiErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: result.error.issues.map((i) => i.message).join("; "),
          details: result.error.issues,
        },
      };
      return res.status(400).json(response);
    }
    req[target] = result.data;
    next();
  };
}

export function requireAdminKey(reqOrHeaderName?: any, res?: Response, next?: NextFunction): any {
  const isExpressCall = 
    reqOrHeaderName && 
    typeof reqOrHeaderName === "object" && 
    reqOrHeaderName.headers && 
    res && 
    typeof res.status === "function" && 
    next;

  const errorPayload: ApiErrorResponse = {
    error: {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
      details: null
    }
  };

  if (isExpressCall) {
    const req = reqOrHeaderName as Request;
    const key = req.headers["x-admin-key"] || req.headers["x-admin-api-key"];
    if (!key || key !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(errorPayload);
    }
    return next();
  }

  const headerName = typeof reqOrHeaderName === "string" ? reqOrHeaderName : "x-admin-key";
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers[headerName] || req.headers["x-admin-api-key"];
    if (!key || key !== process.env.ADMIN_API_KEY) {
      return res.status(401).json(errorPayload);
    }
    next();
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = (err as any).statusCode ?? 500;
  const code = (err as any).code ?? "INTERNAL_ERROR";
  logger.error(`[ERROR] ${req.method} ${req.path} — ${err.message}`, { stack: err.stack });
  res.status(statusCode).json({
    error: {
      code,
      message: err.message,
      details: null,
    },
  } satisfies ApiErrorResponse);
}
