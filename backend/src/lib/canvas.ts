// Canvas REST API client with leaky-bucket rate limiting and 403 backoff.
// Server-side calls use the teacher's PAT (decrypted per-request, never logged).
// See docs/ARCHITECTURE.md#canvas-api-rate-limiting for the budget math.

import { decryptToken } from "./crypto";

const CONCURRENT_MAX = 6;
const inFlight = new Map<string, number>(); // canvasUrl → count

async function acquire(canvasUrl: string): Promise<void> {
  // Naive semaphore — for a hackathon, a per-canvasUrl counter + spin-wait is
  // fine. Replace with a proper AsyncSemaphore at scale.
  while ((inFlight.get(canvasUrl) ?? 0) >= CONCURRENT_MAX) {
    await new Promise((r) => setTimeout(r, 50));
  }
  inFlight.set(canvasUrl, (inFlight.get(canvasUrl) ?? 0) + 1);
}

function release(canvasUrl: string): void {
  inFlight.set(canvasUrl, Math.max(0, (inFlight.get(canvasUrl) ?? 1) - 1));
}

async function withBackoff<T>(fn: () => Promise<Response>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn();
    if (res.status !== 403) {
      if (!res.ok) throw new Error(`Canvas ${res.status}: ${await res.text()}`);
      return (await res.json()) as T;
    }
    // 403 is Canvas's rate-limit signal. Exponential backoff.
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw new Error("Canvas rate-limited after 5 retries");
}

export class CanvasClient {
  constructor(
    private readonly canvasUrl: string,
    private readonly token: string
  ) {}

  static async fromEncrypted(canvasUrl: string, tokenEnc: Uint8Array) {
    const token = await decryptToken(tokenEnc);
    return new CanvasClient(canvasUrl, token);
  }

  private async call<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    await acquire(this.canvasUrl);
    try {
      return await withBackoff<T>(() =>
        fetch(`${this.canvasUrl}/api/v1${path}`, {
          ...init,
          headers: {
            ...init.headers,
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
          },
        })
      );
    } finally {
      release(this.canvasUrl);
    }
  }

  get<T>(path: string) {
    return this.call<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.call<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  put<T>(path: string, body: unknown) {
    return this.call<T>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Verify the token by hitting /users/self. Called during onboarding.
  async verify() {
    return this.get<{ id: number; name: string; login_id: string }>(
      "/users/self"
    );
  }
}
