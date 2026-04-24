# Claude instructions — Canvas AI for Teachers (repo root)

Hackathon build. LA Hacks 2026. Four surfaces across three workspaces plus a docs directory. Read this first when dropped into the repo; then dive into the CLAUDE.md of whichever workspace the task touches.

---

## Repo layout

```
canvas-ai-for-teachers/
├── README.md              one-page pitch + stack + links
├── docs/
│   ├── ARCHITECTURE.md                       system overview, data flow, bubble-first UX, security
│   ├── DATABASE.md                           Postgres + pgvector schema, RLS, retention
│   ├── EXTENSION.md                          Manifest V3, file tree, manifest.json, injection targets
│   ├── QUICKSTART.pdf                        one-page cheat sheet (regenerate via scripts/make_quickstart_pdf.py)
│   ├── canvas-ai-for-teachers.excalidraw     diagram: product + business model + UX
│   └── canvas-ai-technical-plan.excalidraw   diagram: DB schema + extension framework
├── extension/             Chrome extension (Vite + CRXJS + React 18 + TS)
├── web/                   Next.js 15 dashboard
├── backend/               Hono on Bun
├── .env.example           all env vars across workspaces
└── .gitignore
```

Each workspace has its own `CLAUDE.md` with workspace-specific conventions:

- [`extension/CLAUDE.md`](./extension/CLAUDE.md)
- [`web/CLAUDE.md`](./web/CLAUDE.md)
- [`backend/CLAUDE.md`](./backend/CLAUDE.md)

---

## Core product principles

These are load-bearing. Don't drift from them without explicit discussion.

1. **Bubble-first UX.** The teacher types exactly once — at onboarding, to paste their Canvas URL and PAT. Every other interaction is a tap. The only escape hatch is a single `✏ Other…` bubble per tree, which opens a text input and warns the teacher that the AI can't cite unlinked context.

2. **PAT + Chrome extension is the wedge.** Teachers self-onboard in two minutes without IT approval. This bypasses the OAuth2 developer-key gate every competitor is stuck behind. Anything that breaks this promise breaks the GTM motion.

3. **The backend owns secrets.** The PAT is sent once to `/auth/connect` and KMS-wrapped server-side. Neither the extension nor the web app holds PAT plaintext. Both hold a short-lived JWT (15 min) plus a rotating refresh token.

4. **Canvas is called three ways** depending on context:
   - From the extension on `*.instructure.com` pages: `credentials: 'include'` (session cookie). No token in flight from the client.
   - From the service worker to the backend: backend then calls Canvas with the KMS-unwrapped PAT. Rate-limited + 403 backoff.
   - Never directly to Canvas with a token from any non-background page context.

5. **Student-authored text is radioactive.** Zero-retention LLM mode, no training, no caching, hash-only logging. FERPA posture.

---

## What's where

| Concern | Location |
|---|---|
| Product pitch, business model | `README.md` |
| System architecture, data flow, UX rules | `docs/ARCHITECTURE.md` |
| DB schema (SQL, RLS, retention) | `docs/DATABASE.md` |
| Chrome extension framework | `docs/EXTENSION.md` |
| Bubble tree UI component | `extension/src/content/bubbles/` |
| Page-specific injectors | `extension/src/content/targets/` |
| Typed message contracts | `extension/src/shared/messages.ts` **and** `backend/src/types/bubble.ts` — keep in sync |
| Canvas API client with rate limiter | `backend/src/lib/canvas.ts` |
| LLM routing (Opus vs Haiku) | `backend/src/lib/llm.ts` |
| Retrieval from pgvector | `backend/src/lib/context.ts` |
| Token encryption | `backend/src/lib/crypto.ts` |
| Auth flow | `backend/src/routes/auth.ts` |
| Action streaming (SSE) | `backend/src/routes/actions.ts` |

---

## Demo scope (hackathon, 36 hours)

Three hero features. Ship these end-to-end; everything else is roadmap:

1. **Whole-course rebuild** — Opus-authored module tree + assignments + rubrics landing in Canvas
2. **Class risk radar** — Haiku classification of submissions → drafted outreach
3. **Rubric-locked bulk feedback** — SpeedGrader drawer, Haiku fan-out across N submissions with cited criteria

Cut aggressively. No multi-LMS support. No mobile. No Firefox port. No standards library. No admin dashboard. All of that is post-hackathon.

---

## Cross-workspace contracts

When you change one of these, you must change the matching file in another workspace:

- **`BubbleNode` / `BubblePill` / `ActionKind` schemas** —
  `extension/src/shared/messages.ts` ↔ `backend/src/types/bubble.ts`.
  Same Zod definitions, copied not imported (the two workspaces are separate builds).

- **Auth payload shape** —
  what `/auth/connect` returns must match what `extension/src/shared/backend-client.ts` `connect()` expects and what `web/src/app/api/connect/route.ts` forwards.

- **SSE event shape** —
  what `backend/src/routes/actions.ts` emits must match what the extension's service worker (`extension/src/background/service_worker.ts`) and `backend-client.ts` `streamActionStep()` parse.

---

## Getting started

```bash
# 1. clone, install per workspace
cd extension && pnpm install && cd ..
cd web       && pnpm install && cd ..
cd backend   && bun install  && cd ..

# 2. env
cp .env.example .env
# fill in SUPABASE_*, ANTHROPIC_API_KEY, JWT_SECRET (openssl rand -hex 32)

# 3. Supabase — run migrations (see docs/DATABASE.md#migration-plan)
# 4. dev loop — three terminals:
cd backend   && bun run dev           # http://localhost:8787
cd web       && pnpm dev              # http://localhost:3000
cd extension && pnpm dev              # builds into extension/dist; load unpacked in Chrome
```

---

## Conventions shared across workspaces

- TypeScript strict. No `any`.
- Zod at every external boundary (user input, cross-context messages, API route bodies, env vars).
- Path alias `@/*` → `src/*` in every workspace.
- American English in docs and UI copy.
- Comments explain *why*, not *what*. Named identifiers handle the what.
- No `TODO` comments without a companion entry in the issue tracker or PR description. If it's worth a TODO, it's worth being trackable.

---

## What NOT to do

- Don't add a fourth workspace without a very good reason. Three is already three coordination surfaces.
- Don't break the bubble-first rule with a "just this once" text input. If the UX feels like it needs typing, the right answer is almost always "generate more bubble options" or "use the ✏ Other… fallback."
- Don't bypass the backend for LLM calls. Client contexts never see the Anthropic key.
- Don't introduce a new LMS target during the hackathon. Canvas-only depth > multi-LMS breadth.
