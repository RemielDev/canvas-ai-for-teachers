import { Hono } from "hono";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { CanvasClient } from "@/lib/canvas";
import { encryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { mintJwt } from "@/lib/jwt";
import { requireAuth } from "@/middleware/auth";

const app = new Hono();

const ConnectBody = z.object({
  canvas_url: z.string().url(),
  pat: z.string().min(10),
});

// POST /auth/connect — verify PAT, create/update teacher + credentials, mint JWT
app.post("/connect", async (c) => {
  const body = ConnectBody.parse(await c.req.json());

  // Verify the PAT by hitting /users/self with it (no DB writes yet).
  const probe = new CanvasClient(body.canvas_url, body.pat);
  const me = await probe.verify().catch(() => {
    throw new HttpError(400, "could not verify PAT against Canvas");
  });

  // Upsert teacher.
  const { data: teacher, error: terr } = await db
    .from("teachers")
    .upsert(
      {
        email: me.login_id,
        name: me.name,
        canvas_user_id: me.id,
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (terr || !teacher) throw new HttpError(500, "teacher upsert failed");

  // Store KMS-wrapped token.
  const tokenEnc = await encryptToken(body.pat);
  const { error: cerr } = await db.from("canvas_credentials").upsert(
    {
      teacher_id: teacher.id,
      canvas_url: body.canvas_url,
      auth_type: "pat",
      token_enc: Buffer.from(tokenEnc).toString("base64"),
      last_verified_at: new Date().toISOString(),
    },
    { onConflict: "teacher_id,canvas_url" }
  );
  if (cerr) throw new HttpError(500, "credentials write failed");

  const jwt = await mintJwt(teacher.id);
  // TODO: mint and persist a rotating refresh token; wire /auth/refresh.
  const refreshToken = crypto.randomUUID();

  return c.json({ jwt, refreshToken, teacherId: teacher.id });
});

// POST /auth/signout — revoke refresh token. Requires valid JWT.
app.post("/signout", requireAuth, async (c) => {
  const teacherId = c.get("teacherId");
  // TODO: when refresh tokens are persisted, revoke them here.
  await db.from("usage_events").insert({
    teacher_id: teacherId,
    event_type: "signin",
    action_kind: null,
  });
  return c.json({ ok: true });
});

export default app;
