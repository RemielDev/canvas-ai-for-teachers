# Canvas AI for Teachers

A teacher-first Chrome extension and web dashboard that lives inside Canvas LMS. It reads a teacher's course — syllabus, modules, pages, assignments, rubrics, uploads — and gives them tap-only AI workflows for drafting assignments, rebuilding units, surfacing at-risk students, and writing rubric-locked bulk feedback. The extension is the wedge (zero IT approval, teacher installs it themselves); the dashboard is the depth; the district sale is the destination.

**Hackathon build — LA Hacks 2026.**

---

## Why this wins

- **Teacher-side extensions are a gap.** The popular Canvas extensions (Better Canvas, Canvas Grade Calculator, Tasks for Canvas) are student-side. Teachers get separate webapps, not in-page AI.
- **PAT bypasses the OAuth2 admin-approval gate.** Every competitor needs district IT to approve their developer key before a teacher can log in. A teacher-generated Personal Access Token (PAT) lets a teacher onboard solo in two minutes. That's the entire product-led-growth motion.
- **Whole-unit rebuild, not worksheets.** Brisk Teaching (the closest competitor, ~$15M Series A) stops at worksheet generation. We rebuild full units — module tree, assignments, quizzes, rubrics, aligned to standards — in one action.

---

## Three hero features

1. **Whole-course rebuild** — "Regenerate Unit 4 around the new NGSS standards, keep my rubric voice." Opus writes ~100 Canvas API calls in ~45 seconds via a rate-limited batcher. Teacher previews a diff before anything lands in live Canvas.
2. **Class risk radar** — Haiku reads `/analytics` + `/submissions` and surfaces at-risk students with pre-drafted personalized outreach, differentiated assignments, and parent messages in multiple languages.
3. **Rubric-locked bulk feedback** — In SpeedGrader, pick a rubric criterion and bulk-generate feedback across 20+ submissions, each comment grounded in a specific criterion with cited text spans. No generic "great work!" slop.

---

## Bubble-first UX

The teacher types exactly once — at onboarding, to paste their Canvas URL and PAT. After that, **every interaction is a tap**. Each AI action is a bubble tree: the LLM pre-computes the next row of plausible options using the class context, so there's no blank-page problem. A single `✏ Other…` bubble is the only fallback to typing, reserved for the ~5% of edge cases nothing else covers.

The five onboarding steps: **Connect → Pick class → AI scans → Gap check → Act.** See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#bubble-first-ux) for the full flow.

---

## Stack

| Layer | Choice |
|---|---|
| Chrome extension | Vite + CRXJS · React 18 · TypeScript strict · Zod |
| Web dashboard | Next.js 15 (app router) · shadcn/ui · Tailwind · React Query |
| Backend | Hono on Bun *or* FastAPI · Anthropic SDK · pdfplumber / pypdf |
| Database | Supabase (Postgres 16 + pgvector) · Drizzle ORM · RLS on |
| Auth | Supabase Auth + extension JWT + Canvas PAT/OAuth2 vault |
| LLM | Claude Opus 4.7 (authoring) · Claude Haiku 4.5 (scale tasks) |
| Payments | Stripe Billing (Pro tier); purchase orders for district |
| Hosting | Vercel (site) · Fly.io or Cloudflare (backend) · Supabase (db) |
| Testing | Playwright against Canvas Free-for-Teachers sandbox |

---

## Repo layout

```
canvas-ai-for-teachers/
├── README.md
├── docs/
│   ├── ARCHITECTURE.md     system overview, data flow, UX principles
│   ├── DATABASE.md         Postgres schema, RLS, pgvector
│   └── EXTENSION.md        Manifest V3, injection targets, message flow
├── extension/              Chrome extension (Vite + CRXJS)
├── web/                    Next.js dashboard
├── backend/                API + LLM orchestrator + Canvas proxy
└── supabase/               migrations, seed data, RLS policies
```

(Source directories don't exist yet — scaffolding is the next task after these docs.)

---

## Business model

| Tier | Price | Auth | Who it's for |
|---|---|---|---|
| **Free** | $0 | Canvas PAT | Single teacher, self-serve, ~20 AI actions/day, virality |
| **Teacher Pro** | $9–12/mo | Teacher PAT or OAuth2 | Power teachers, dept chairs, instructional coaches. Unlimited AI. |
| **School / District** | 5-figure ACV | Institutional OAuth2 + SSO | Admin dashboard, BAA/DPA, SIS roster sync, audit log, custom branding |

Free-teacher usage data is the sales evidence that closes the district deal. PLG motion, not enterprise-first cold outbound.

---

## Docs

- [Architecture](./docs/ARCHITECTURE.md) — components, data flow, LLM routing, UX, security at 10,000 ft
- [Database](./docs/DATABASE.md) — schema, RLS, pgvector, retention, migration order
- [Extension](./docs/EXTENSION.md) — Manifest V3, file tree, `manifest.json`, message flow, injection targets, auth
- [Quickstart PDF](./docs/QUICKSTART.pdf) — one-page cheat sheet (workspaces + diagram + run commands + happy-path flow)
- [Diagram: product + business](./docs/canvas-ai-for-teachers.excalidraw) — system, three hero features, go-to-market funnel, bubble-first UX
- [Diagram: technical plan](./docs/canvas-ai-technical-plan.excalidraw) — database schema (10 tables) + Chrome extension framework (manifest, file tree, message flow, injection targets)

Open `.excalidraw` files with [excalidraw.com](https://excalidraw.com) (drag-and-drop), the VS Code Excalidraw extension, or Obsidian's Excalidraw plugin.

---

## Status

Hackathon build. LA Hacks 2026. Design finalized; scaffolding next.
