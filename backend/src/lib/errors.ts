import type { Context } from "hono";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as never);
  }
  console.error("[canvas-ai-backend] unhandled", err);
  return c.json({ error: "internal error" }, 500);
}
