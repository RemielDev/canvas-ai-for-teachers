// Thin proxy from the web form to the backend /auth/connect endpoint.
// Keeps the PAT off the client for more than one request hop.

import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  canvas_url: z.string().url(),
  pat: z.string().min(10),
});

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8787";

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const res = await fetch(`${BACKEND_URL}/auth/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: await res.text() },
      { status: res.status }
    );
  }
  const data = await res.json();

  // Set a session cookie so the dashboard can identify the teacher.
  const response = NextResponse.json({ ok: true, teacherId: data.teacherId });
  response.cookies.set("canvas_ai_jwt", data.jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15, // 15 min, matches backend JWT TTL
  });
  response.cookies.set("canvas_ai_refresh", data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
