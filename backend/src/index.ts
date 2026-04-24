import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "@/routes/auth";
import actionRoutes from "@/routes/actions";
import coursesRoutes from "@/routes/courses";
import { errorHandler } from "@/lib/errors";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "https://canvasai.app",
      "https://*.canvasai.app",
      "http://localhost:3000",
      "chrome-extension://*",
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/", (c) => c.json({ ok: true, service: "canvas-ai-backend" }));
app.get("/health", (c) => c.json({ status: "healthy", t: Date.now() }));

app.route("/auth", authRoutes);
app.route("/actions", actionRoutes);
app.route("/courses", coursesRoutes);

app.onError(errorHandler);

export default {
  port: Number(process.env.PORT ?? 8787),
  fetch: app.fetch,
};
