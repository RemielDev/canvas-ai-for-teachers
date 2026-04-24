# Architecture

System-level view. How the pieces fit, how a request flows, and what rules the LLM and the Canvas API play by.

See also: [Database schema](./DATABASE.md) · [Chrome Extension framework](./EXTENSION.md) · [README](../README.md)

---

## Components

### Chrome Extension (primary surface)

Lives on `*.instructure.com`. A content script detects the current page type (assignment editor, SpeedGrader, gradebook, course home, module view) and mounts a React root with injected AI affordances. A long-lived service worker handles auth, backend calls, and streaming.

The extension makes Canvas API calls via the teacher's logged-in session cookie (`credentials: 'include'`), so no token is handed off from page context. Backend calls carry a short-lived JWT minted at onboarding.

### Web Dashboard (depth surface)

Next.js 15 app router. For workflows that don't fit in a bubble panel: cross-course analytics, bulk ops, standards alignment, scheduled unit rebuilds, admin dashboards (district tier). Uses the same backend API as the extension.

### Backend Orchestrator

Thin proxy over Canvas REST API + retrieval-augmented LLM router.

Responsibilities:
- Rate-limit Canvas calls (leaky bucket; see below)
- Route LLM calls to Opus vs Haiku by action kind
- Enforce zero-retention on student-authored text
- Hold KMS-wrapped OAuth2 refresh tokens for paid tiers
- Stream bubble-tree responses via Server-Sent Events

### Canvas REST API

`api.instructure.com/api/v1/*`. Endpoints used:

- `POST /accounts/:id/courses`
- `POST /courses/:id/assignments` · `PUT /courses/:id/assignments/:aid`
- `POST /courses/:id/modules` · `POST /courses/:id/pages`
- `POST /courses/:id/quizzes`
- `GET  /courses/:id/students/submissions`
- `GET  /courses/:id/analytics/assignments`
- `POST /courses/:id/rubrics`
- `GET  /users/self/files` · file-upload 3-step flow

### LLM Layer

Claude via the Anthropic SDK, split by cost envelope:

- **Opus 4.7** — heavy authoring. Unit rebuild, curriculum mapping, whole-assignment draft with rubric alignment.
- **Haiku 4.5** — scale tasks. Bulk feedback, submission summaries, at-risk classification, short-form bubble-option generation.

Guardrails: Business Associate Agreement / DPA with Anthropic for district tier; zero-retention mode flagged on any call that carries student content; no student data used for training.

---

## Data flow — "Draft assignment" end-to-end

Walk through a single action to anchor the rest of the doc.

1. **Teacher opens** an assignment in Canvas. Content script detects `/courses/:id/assignments/:aid/edit` and injects an `✨ AI draft` button next to the native Save.
2. **Teacher taps** the button. `BubbleTree.tsx` renders the first row: unit options pre-computed from `course_contexts`.
3. **Each tap** dispatches `chrome.runtime.sendMessage({ type: 'action.step', actionId, picks })` to the service worker, typed and Zod-validated via `shared/messages.ts`.
4. **Service worker** hits the backend: `POST https://api.canvasai.app/actions/:id/step` with the teacher's JWT. Backend retrieves top-k relevant chunks from `course_embeddings` (pgvector, `ivfflat` index, cosine distance), assembles a prompt, and calls the appropriate model.
5. **Backend streams** a `BubbleNode` response: `{ label, options: BubblePill[], requiresContext: string[] }`. If `requiresContext` flags anything missing (e.g., no rubric format on file), the next bubble row is an upload prompt instead of more picks.
6. **Service worker** pipes the stream through `port.postMessage` back to the content script. `BubbleTree` re-renders.
7. **At terminal step** (teacher taps `✨ Generate`), the backend performs the full authoring call (Opus for draft-assignment), returns a preview diff. Teacher sees bubbles: `[Push to Canvas]` `[Regenerate]` `[Tweak tone]` `[✏ Other…]`.
8. **Push to Canvas** writes via `PUT /api/v1/courses/:id/assignments/:aid` with `credentials: 'include'` — the Canvas session cookie authorizes the write.

---

## LLM routing policy

| Action kind | Model | Why |
|---|---|---|
| `draft_assignment` | Opus | High-quality prose, rubric alignment, standards mapping |
| `rebuild_unit` | Opus | Multi-step plan; module tree + assignments + quizzes generated coherently |
| `bulk_feedback` | Haiku | Runs across 20+ submissions; cost must scale linearly with students |
| `risk_radar_classify` | Haiku | Short-form classification across gradebook rows |
| `outreach_draft` | Haiku | Short personalized emails; quantity matters more than depth |
| `bubble_option_gen` | Haiku | Every tap triggers one; latency-critical, cheap |
| `context_sufficiency_check` | Haiku | Structured yes/no-per-field output, no prose |

Rule of thumb: Opus for things the teacher reads once and ships; Haiku for anything we call N times per action.

---

## Canvas API rate-limiting

Canvas uses a leaky-bucket throttle: ~700 cost units per token, regenerating ~10 units/sec. Each request costs ~50 base units plus processing. Sustained throughput is roughly **10 req/sec**.

The backend's Canvas client enforces:

- Concurrent semaphore of **5–8** in-flight requests per teacher
- Exponential backoff on `403 Forbidden` (Canvas's rate-limit response, not `429`)
- Respect the `X-Rate-Limit-Remaining` cost header when present
- `Link` header pagination handled automatically

A whole-unit rebuild is ~100–200 Canvas calls and finishes in 20–60 seconds with these settings.

---

## Bubble-first UX

### The rule

The teacher types exactly once — at onboarding, to paste their Canvas URL and PAT (or click OAuth on paid tier). After that, every interaction is a tap. The LLM pre-computes the next row of plausible options using the class context, so there is no blank-page problem.

### Onboarding (5 steps)

1. **Connect** — paste Canvas URL + PAT. **The only typed screen, ever.**
2. **Pick class** — `GET /api/v1/courses` returns the teacher's courses; render one bubble per course (name, term, enrollment). Tap one.
3. **AI scans** — ingest syllabus, modules, pages, assignments, rubrics, quizzes, uploaded PDF/DOCX/PPTX. Extract → chunk → embed → store in per-class `course_embeddings` (pgvector).
4. **Gap check** — a per-action checklist, not a vibes score. `syllabus ✓ · rubric ? · lecture deck ✗ · textbook ✗` — bubbles offer upload or proceed-with-warning (quality badge drops).
5. **Act** — every feature is a bubble tree. Draft assignment, rebuild unit, risk radar, bulk feedback.

### Bubble tree example — "Draft assignment"

```
Tap: Draft assignment
  [Unit 1] [Unit 2 ✓] [Unit 3] [Unit 4]           ← pick unit
  [Essay ✓] [Problem set] [Quiz] [Project] [Lab]  ← pick type
  [AP] [Honors ✓] [Standard] [Remedial]           ← pick level
  [1 class] [Week-long ✓] [Unit capstone]          ← pick length
  [✨ Generate]
     → preview diff
        [Push to Canvas] [Regenerate] [Tweak tone] [✏ Other…]
```

### The `✏ Other…` fallback

Exactly one escape hatch. Opens a small text input for the ~5% of edge cases nothing else covers (weird custom project, niche rubric criterion, student-specific accommodation). The preview carries a quality badge warning the teacher that typed context is un-grounded — the LLM can't cite it against a syllabus or rubric the same way.

---

## Context architecture

Every AI action is retrieval-augmented against a **per-class vector store**.

### Ingest pipeline

```
Canvas scan  +  uploaded PDF / DOCX / PPTX
    ↓
text extraction  (pdfplumber / python-docx / python-pptx)
    ↓
chunking  (target ~500 tokens, 50-token overlap, heading-aware)
    ↓
embedding  (1536-dim; pick one model and stick with it — see DATABASE.md)
    ↓
store  →  course_contexts + course_embeddings  (Supabase pgvector)
```

### Context sufficiency is a checklist

Each action declares its required context fields up front. Examples:

- `draft_assignment` requires: `syllabus ✓`, `standards ✓`, `≥1 rubric sample ✓`
- `rubric_locked_feedback` requires: `rubric ✓`, `student text ✓` (from Canvas)
- `rebuild_unit` requires: `syllabus ✓`, `existing unit structure ✓`, `rubric style ✓`, `textbook or core reading ? (degraded-quality if missing)`

The gap check doesn't block the teacher — it offers upload bubbles and a "proceed with lower quality" option, with an honest quality badge.

---

## Security & compliance at 10,000 ft

Detail lives in [DATABASE.md](./DATABASE.md#security-controls) and [EXTENSION.md](./EXTENSION.md#security-posture). Headlines:

- **PAT** is exchanged once at onboarding for a short-lived JWT; never stored in the extension long-term.
- **OAuth2 refresh tokens** (paid tier) live server-side, KMS-wrapped.
- **Row-Level Security** on every Postgres table, scoped by `teacher_id` or `org_id`.
- **Zero-retention mode** on any LLM call carrying student-authored text.
- **Audit log** (`usage_events`) is immutable, 7-year retention, for FERPA compliance.
- **Soft-delete cascade** from teacher → courses → contexts → embeddings, with a 30-day purge window.
- **Chrome extension** stores no student PII, no embeddings, no PAT plaintext. IndexedDB has a 7-day idle TTL and clears on sign-out or on permissions revoke.
