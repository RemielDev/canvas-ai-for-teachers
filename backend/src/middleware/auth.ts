import { createMiddleware } from "hono/factory";
import { HttpError } from "@/lib/errors";
import { verifyJwt } from "@/lib/jwt";

export const requireAuth = createMiddleware<{
  Variables: { teacherId: string };
}>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "missing bearer token");
  }
  try {
    const { teacherId } = await verifyJwt(header.slice(7));
    c.set("teacherId", teacherId);
  } catch {
    throw new HttpError(401, "invalid or expired token");
  }
  await next();
});
