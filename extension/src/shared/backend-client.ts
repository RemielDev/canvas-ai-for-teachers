// Client for our own backend (api.canvasai.app). Attaches JWT, auto-refreshes.
// Never call Canvas directly from here — use canvas-client.ts for that.

import * as storage from "./storage";

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ?? "https://api.canvasai.app";

async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const jwt = await storage.get("jwt");
  const headers = new Headers(init.headers);
  if (jwt) headers.set("Authorization", `Bearer ${jwt}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${BACKEND_URL}${path}`, { ...init, headers });
}

export async function connect(
  canvasUrl: string,
  pat: string
): Promise<{ jwt: string; refreshToken: string; teacherId: string }> {
  const res = await fetch(`${BACKEND_URL}/auth/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ canvas_url: canvasUrl, pat }),
  });
  if (!res.ok) throw new Error(`Connect failed: ${res.status}`);
  return res.json();
}

export async function signout(): Promise<void> {
  await authedFetch("/auth/signout", { method: "POST" });
  await storage.clearAll();
}

export async function startAction(
  kind: string,
  courseId: string
): Promise<{ actionId: string }> {
  const res = await authedFetch("/actions/start", {
    method: "POST",
    body: JSON.stringify({ kind, course_id: courseId }),
  });
  return res.json();
}

export async function* streamActionStep(
  actionId: string,
  picks: Record<string, string>
): AsyncGenerator<unknown, void, void> {
  const res = await authedFetch(`/actions/${actionId}/step`, {
    method: "POST",
    body: JSON.stringify({ picks }),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.startsWith("data: ")) continue;
      yield JSON.parse(part.slice(6));
    }
  }
}
