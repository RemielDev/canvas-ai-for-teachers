# Claude instructions — `backend/`

Hono on Bun. The orchestrator. Canvas API proxy + LLM router + retrieval + auth.

---

## What this directory is

The backend at `api.canvasai.app`. It:

1. Holds KMS-wrapped Canvas credentials and mints short-lived JWTs for the extension and web app.
2. Proxies Canvas REST API calls with rate-limiting and 403 backoff.
3. Orchestrates AI actions — retrieves relevant context from pgvector, routes to Opus or Haiku, streams `BubbleNode` responses back over SSE.
4. Owns the audit log (`usage_events`) and zero-retention policy on student-authored text.

The browser clients (extension + web) never call Canvas or the LLM directly. Everything funnels through here.

For full system context: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md). Schema: [`../docs/DATABASE.md`](../docs/DATABASE.md).

---

## Stack

- **Runtime:** Bun (faster cold start than Node, built-in TypeScript, built-in test runner). Deployable to Fly.io or Cloudflare Workers (minor adjustments for Workers).
- **Framework:** Hono — minimal, edge-friendly, good SSE support via `hono/streaming`.
- **LLM:** Anthropic SDK (Claude Opus 4.7 for authoring, Haiku 4.5 for scale)
- **DB:** Supabase JS client with service-role key (server-only)
- **Auth:** `jose` for JWT signing/verification (HS256)
- **Validation:** Zod at every route boundary
- **Crypto:** Bun's built-in `crypto.subtle` (AES-GCM) for hackathon; production swaps to AWS KMS envelope encryption

---

## Commands

```bash
bun install
bun run dev      # watch + reload on http://localhost:8787
bun run start    # production
bun run typecheck
bun test
```

Environment variables live in `.env` (git-ignored). See `.env.example` at the repo root.

---

## File layout

- `src/index.ts` — Hono app wiring: CORS, logger, route mounts, error handler
- `src/routes/`
  - `auth.ts` — `/auth/connect`, `/auth/signout`. Verifies PAT, KMS-wraps, upserts `teachers` + `canvas_credentials`, mints JWT
  - `courses.ts` — `/courses`, `/courses/sync`, `/courses/:id/scan`
  - `actions.ts` — `/actions/start`, `/actions/:id/step` (SSE streaming)
- `src/middleware/auth.ts` — `requireAuth` middleware that verifies JWT and stashes `teacherId` on the context
- `src/lib/`
  - `env.ts` — Zod-validated env vars; fail-fast on boot
  - `db.ts` — Supabase service-role client (never exposed to browsers)
  - `jwt.ts` — mint + verify via jose
  - `crypto.ts` — AES-GCM wrapper for `canvas_credentials.token_enc` (KMS-ready abstraction)
  - `canvas.ts` — Canvas REST client with per-URL semaphore and 403 backoff
  - `llm.ts` — Anthropic SDK wrapper; `modelForAction()` routes Opus vs Haiku
  - `context.ts` — pgvector retrieval via Supabase RPC; prompt formatting
  - `errors.ts` — `HttpError` class + global error handler
- `src/types/`
  - `bubble.ts` — `BubbleNode` / `BubblePill` / `ActionKind` Zod schemas. **Must stay in sync with `extension/src/shared/messages.ts`.**

---

## Conventions

- **Zod at the boundary.** Every route parses its body with a Zod schema. Never trust raw request JSON.
- **Service-role key stays server-side.** `src/lib/db.ts` is the only place it appears. If you need to run user-scoped queries, create a separate client with the anon key + user JWT so RLS applies.
- **Credentials flow.** PAT arrives at `/auth/connect` → verified by hitting Canvas `/users/self` → `encryptToken()` → stored as base64-encoded bytea. On every subsequent Canvas call, `CanvasClient.fromEncrypted()` decrypts in memory, uses, and drops.
- **Rate-limit Canvas.** Always go through `CanvasClient`. Never `fetch()` `*.instructure.com` directly from a route — you'll bypass the semaphore and backoff.
- **LLM routing.** Use `modelForAction(kind)` — don't hardcode a model in a route.
- **Zero-retention flag.** When building a prompt that includes student-authored text, set `zeroRetention: true` on the `callLLM` opts (TODO: wire the extraHeaders once we verify the exact Anthropic header name).
- **Audit everything.** Every LLM call, every Canvas write, every sign-in writes a row to `usage_events`. Immutable, 7-year retention. Used for FERPA audit and district-sale evidence.
- **SSE streaming.** Long actions stream `BubbleNode`s via `streamSSE`. Clients read them with a `ReadableStream` + `TextDecoder`. Never buffer and dump at the end — latency matters.

---

## Adding a new action kind

1. Add the kind to `ActionKind` in `src/types/bubble.ts` AND `extension/src/shared/messages.ts`. Keep them in sync.
2. Add the routing rule in `src/lib/llm.ts` `modelForAction()`.
3. Add the per-kind bubble-tree walker in `src/routes/actions.ts` — decides what `BubbleNode` to emit at each step given the picks so far. Hackathon shortcut: hard-code the tree per kind. Production: let the LLM generate node options from retrieved context.
4. Add the terminal authoring function (the actual generation). Call `callLLM` with the kind-appropriate model.
5. If the action writes to Canvas, add a `CanvasClient` call sequence inside a preview-before-commit pattern — return the proposed writes to the client as a diff; only execute when the teacher taps `Push to Canvas`.

---

## What NOT to do

- Don't log PAT or refresh tokens. Not to console, not to stdout, not to a file, not to Sentry. Period.
- Don't log student-authored content. Log `input_hash` + `output_hash` instead.
- Don't put the Canvas PAT in the JWT payload. The JWT only carries `teacherId`; credentials are looked up per-request.
- Don't call `anthropic.messages.create` directly from a route — go through `callLLM` so retention flags and audit stamps happen in one place.
- Don't skip RLS by using service-role for things that should be RLS-scoped. Service-role is for backend-system operations (writing audit events, bulk upserts during scan). User-initiated reads/writes should still be RLS-aware.
- Don't implement refresh-token rotation as "just reuse the same one." Rotate on every use; invalidate the old one.

---

## Environment variables

`.env` (git-ignored):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role>
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=<32+ char random>
KMS_KEY_ID=  # optional; empty = local hackathon crypto
PORT=8787
```

Zod fails boot if anything required is missing. See `src/lib/env.ts`.
