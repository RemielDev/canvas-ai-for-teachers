# Database

Postgres 16 on Supabase with `pgvector` and `pgcrypto`. Single source of truth for tenants, Canvas integration, AI context, actions, and usage.

See also: [Architecture](./ARCHITECTURE.md) · [Extension](./EXTENSION.md) · [README](../README.md)

---

## Overview

**Why Supabase.** Out-of-the-box Postgres with pgvector, Row-Level Security, Auth, a Storage bucket for uploads, and Edge Functions — so a single managed product covers most of our needs without dedicated DevOps during the hackathon.

**Why pgvector.** Embeddings live next to their source rows. One transactional store, one backup story. We avoid a second system (Pinecone, Weaviate) until scale forces the split.

**Extensions used:**

```sql
create extension if not exists "vector";
create extension if not exists "pgcrypto";
```

**Embedding dimension.** Pick one model and stick with it across the schema. Default: **1536** (matches OpenAI `text-embedding-3-small` and Voyage `voyage-3`). If we switch to Cohere `embed-english-v3.0` we'd drop to 1024 — but the `vector(N)` column type is not adjustable without a rewrite, so this is a one-time decision.

---

## Tables

### `teachers`

The primary user entity. A teacher can be independent (free / pro) or belong to an organization (district).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `email` | `text` | unique, not null |
| `name` | `text` | |
| `plan_tier` | `text` | enum: `free` \| `pro` \| `district` |
| `org_id` | `uuid` | FK → `organizations.id`, nullable |
| `canvas_user_id` | `bigint` | the teacher's user id inside Canvas, nullable until connected |
| `created_at` | `timestamptz` | default `now()` |

```sql
create table teachers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  name            text,
  plan_tier       text not null default 'free'
                   check (plan_tier in ('free','pro','district')),
  org_id          uuid references organizations(id) on delete set null,
  canvas_user_id  bigint,
  created_at      timestamptz not null default now()
);
create index on teachers (org_id);
```

### `organizations`

Districts or schools that have signed a DPA / BAA and provisioned institutional OAuth2.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `text` | |
| `domain` | `text` | unique — used for email-domain auto-linking |
| `canvas_url` | `text` | e.g. `https://lausd.instructure.com` |
| `oauth2_key_id` | `text` | the developer key issued by the district's Canvas admin |
| `dpa_signed_at` | `timestamptz` | null until legal cleared |

```sql
create table organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  domain          text unique,
  canvas_url      text not null,
  oauth2_key_id   text,
  dpa_signed_at   timestamptz
);
```

### `subscriptions`

Stripe-backed billing for Pro; PO-backed for district (the org-wide `subscriptions` row carries `stripe_sub_id = null`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `teacher_id` | `uuid` | FK, nullable when org-scoped |
| `org_id` | `uuid` | FK, nullable when teacher-scoped |
| `stripe_sub_id` | `text` | nullable |
| `tier` | `text` | `pro` \| `district` |
| `status` | `text` | `active` \| `past_due` \| `canceled` |
| `period_end` | `timestamptz` | |

```sql
create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid references teachers(id) on delete cascade,
  org_id          uuid references organizations(id) on delete cascade,
  stripe_sub_id   text,
  tier            text not null check (tier in ('pro','district')),
  status          text not null check (status in ('active','past_due','canceled')),
  period_end      timestamptz not null,
  check (teacher_id is not null or org_id is not null)
);
```

### `canvas_credentials`

Teacher-scoped Canvas auth. PAT for free tier, OAuth2 for paid. Tokens are always KMS-wrapped at rest.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `teacher_id` | `uuid` | FK |
| `canvas_url` | `text` | |
| `auth_type` | `text` | `pat` \| `oauth2` |
| `token_enc` | `bytea` | KMS envelope-encrypted |
| `refresh_token_enc` | `bytea` | OAuth2 only |
| `scope` | `text` | nullable (PAT has implicit full scope) |
| `expires_at` | `timestamptz` | null for PAT |
| `last_verified_at` | `timestamptz` | refreshed when we successfully call `/users/self` |

```sql
create table canvas_credentials (
  id                  uuid primary key default gen_random_uuid(),
  teacher_id          uuid not null references teachers(id) on delete cascade,
  canvas_url          text not null,
  auth_type           text not null check (auth_type in ('pat','oauth2')),
  token_enc           bytea not null,
  refresh_token_enc   bytea,
  scope               text,
  expires_at          timestamptz,
  last_verified_at    timestamptz,
  unique (teacher_id, canvas_url)
);
```

### `courses`

One row per Canvas course the teacher has connected. `quality_score` is the rolled-up context sufficiency.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `teacher_id` | `uuid` | FK |
| `canvas_course_id` | `bigint` | Canvas's numeric id |
| `name` | `text` | |
| `term` | `text` | |
| `code` | `text` | course code (e.g. `CHEM101`) |
| `enrollment_count` | `int` | |
| `scan_status` | `text` | `idle` \| `scanning` \| `ready` \| `error` |
| `last_scanned_at` | `timestamptz` | |
| `quality_score` | `int` | 0–100, rubric across context fields |

```sql
create table courses (
  id                uuid primary key default gen_random_uuid(),
  teacher_id        uuid not null references teachers(id) on delete cascade,
  canvas_course_id  bigint not null,
  name              text not null,
  term              text,
  code              text,
  enrollment_count  int,
  scan_status       text not null default 'idle'
                     check (scan_status in ('idle','scanning','ready','error')),
  last_scanned_at   timestamptz,
  quality_score     int check (quality_score between 0 and 100),
  unique (teacher_id, canvas_course_id)
);
create index on courses (teacher_id);
```

### `course_contexts`

Everything we ingested about a course, before chunking. One row per logical item (one page, one assignment, one PDF, etc.).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `course_id` | `uuid` | FK |
| `kind` | `text` | `syllabus` \| `module` \| `page` \| `assignment` \| `file` \| `rubric` \| `quiz` \| `announcement` |
| `canvas_ref_id` | `bigint` | nullable (uploaded files have no Canvas id) |
| `title` | `text` | |
| `content_hash` | `text` | sha256 for change detection |
| `raw_text` | `text` | extracted plaintext |
| `updated_at` | `timestamptz` | |

```sql
create table course_contexts (
  id              uuid primary key default gen_random_uuid(),
  course_id       uuid not null references courses(id) on delete cascade,
  kind            text not null check (kind in
                   ('syllabus','module','page','assignment',
                    'file','rubric','quiz','announcement')),
  canvas_ref_id   bigint,
  title           text,
  content_hash    text not null,
  raw_text        text,
  updated_at      timestamptz not null default now()
);
create index on course_contexts (course_id, kind);
create index on course_contexts (content_hash);
```

### `course_embeddings`

The vector store. One row per chunk. `ivfflat` index on cosine distance.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `course_id` | `uuid` | FK — duplicated from `course_contexts` for fast per-class retrieval |
| `context_id` | `uuid` | FK |
| `chunk_idx` | `int` | ordinal inside the context |
| `chunk_text` | `text` | |
| `embedding` | `vector(1536)` | |
| `token_count` | `int` | |
| `metadata` | `jsonb` | `{ heading, page, unit }` and similar |

```sql
create table course_embeddings (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  context_id    uuid not null references course_contexts(id) on delete cascade,
  chunk_idx     int not null,
  chunk_text    text not null,
  embedding     vector(1536) not null,
  token_count   int,
  metadata      jsonb not null default '{}'::jsonb
);
create index on course_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
create index on course_embeddings (course_id);
```

**ivfflat lists heuristic.** Start with `lists = sqrt(expected_rows)`. For a typical class (~5k chunks after scan + textbook), that's ~70; `100` is a safe default. Revisit if query p99 climbs above ~50ms.

### `actions`

A single user-initiated workflow (one draft, one unit rebuild, one bulk-feedback run). `inputs_jsonb` accumulates the bubble picks as the tree is walked.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `teacher_id` | `uuid` | FK |
| `course_id` | `uuid` | FK |
| `kind` | `text` | `draft_assignment` \| `rebuild_unit` \| `risk_radar` \| `bulk_feedback` \| `custom` |
| `inputs_jsonb` | `jsonb` | bubble picks accumulated per step |
| `status` | `text` | `pending` \| `running` \| `done` \| `error` |
| `created_at` | `timestamptz` | |

```sql
create table actions (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references teachers(id) on delete cascade,
  course_id     uuid not null references courses(id) on delete cascade,
  kind          text not null check (kind in
                 ('draft_assignment','rebuild_unit','risk_radar',
                  'bulk_feedback','custom')),
  inputs_jsonb  jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                 check (status in ('pending','running','done','error')),
  created_at    timestamptz not null default now()
);
create index on actions (teacher_id, created_at desc);
```

### `action_results`

The generated output. Separate table so actions can be retried without invalidating previous results.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `action_id` | `uuid` | FK |
| `output_jsonb` | `jsonb` | preview diff, generated content, per-field cites |
| `tokens_in` | `int` | |
| `tokens_out` | `int` | |
| `cost_cents` | `int` | |
| `published_to_canvas_at` | `timestamptz` | null until teacher taps "Push to Canvas" |
| `canvas_refs_jsonb` | `jsonb` | Canvas ids of entities we wrote (for rollback) |

```sql
create table action_results (
  id                       uuid primary key default gen_random_uuid(),
  action_id                uuid not null references actions(id) on delete cascade,
  output_jsonb             jsonb not null,
  tokens_in                int,
  tokens_out               int,
  cost_cents               int,
  published_to_canvas_at   timestamptz,
  canvas_refs_jsonb        jsonb
);
create index on action_results (action_id);
```

### `usage_events`

Immutable audit + rate-limit log. Every LLM call, every Canvas write, every sign-in.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `teacher_id` | `uuid` | FK |
| `event_type` | `text` | `llm_call` \| `canvas_write` \| `signin` \| `upload` \| `rate_limited` |
| `action_kind` | `text` | nullable |
| `tokens` | `int` | nullable |
| `cost_cents` | `int` | nullable |
| `occurred_at` | `timestamptz` | |

```sql
create table usage_events (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references teachers(id),
  event_type   text not null,
  action_kind  text,
  tokens       int,
  cost_cents   int,
  occurred_at  timestamptz not null default now()
);
create index on usage_events (teacher_id, occurred_at desc);
```

---

## Relationships

```
organizations (1) ─── (N) teachers
teachers      (1) ─── (N) canvas_credentials
teachers      (1) ─── (N) courses
courses       (1) ─── (N) course_contexts
course_contexts (1) ─ (N) course_embeddings  (course_id also denormalized here)
teachers      (1) ─── (N) actions
actions       (1) ─── (N) action_results
teachers      (1) ─── (N) usage_events
teachers/org  (1) ─── (N) subscriptions
```

**Cascade behavior.** Deleting a teacher cascades through courses → contexts → embeddings → actions → results. `usage_events` is **not** cascaded — it's the audit log and must survive account deletion for FERPA retention. Soft-delete is preferred; hard-delete runs on a 30-day purge.

---

## Row-Level Security

Enable RLS on every tenant-scoped table. Supabase exposes `auth.uid()` which we map to `teachers.id` via a `profiles`-style linkage (or the teacher id is the Supabase user id directly — simpler, do this).

```sql
alter table courses enable row level security;

create policy "teachers read their own courses"
  on courses for select
  using (teacher_id = auth.uid());

create policy "teachers write their own courses"
  on courses for insert with check (teacher_id = auth.uid());

create policy "teachers update their own courses"
  on courses for update using (teacher_id = auth.uid());

create policy "teachers delete their own courses"
  on courses for delete using (teacher_id = auth.uid());
```

Repeat the pattern for `canvas_credentials`, `course_contexts`, `course_embeddings`, `actions`, `action_results`, `subscriptions` (when teacher-scoped), `usage_events` (read-only).

**District-tier escalation.** `organizations` admins need read access to all courses under their org. Add a second policy:

```sql
create policy "org admins read their org's courses"
  on courses for select
  using (
    teacher_id in (
      select id from teachers where org_id = (
        select org_id from teachers where id = auth.uid() and org_id is not null
      )
    )
  );
```

Gate on a `role = 'admin'` claim once we have it; for the hackathon, all org members get read-only.

---

## Data locality

| Location | What lives here |
|---|---|
| **Postgres (authoritative)** | All tables above. Embeddings, raw text, credentials, audit log. |
| **Chrome extension storage** (`chrome.storage.local` + IndexedDB) | Cached course list, last-scan timestamp, recent bubble trees. Session JWT only. **No** student PII, **no** embeddings, **no** PAT plaintext. Clears on sign-out or 7-day idle TTL. |
| **Web app** (Next.js) | SWR cache only. Server-side sessions via http-only cookie. No persistent client store. |

---

## Security controls

- **Token encryption.** `canvas_credentials.token_enc` and `refresh_token_enc` use KMS envelope encryption (AWS KMS or GCP KMS). Plaintext tokens never sit in Postgres. On decrypt, tokens live in memory only for the duration of a single outbound Canvas request.
- **RLS everywhere.** Every tenant-scoped table has RLS on by default; a migration that omits RLS fails CI.
- **Student-authored text.** `course_contexts.raw_text` carrying student submissions is flagged `zero_retention_required=true` in metadata. LLM calls for `bulk_feedback` or `risk_radar` use Anthropic's zero-retention mode.
- **Retention.** `course_contexts`: 30 days default after course disconnect; per-org override. `usage_events`: 7 years (FERPA audit). `action_results`: 90 days.
- **Soft-delete.** Teacher, course, and context deletes set a `deleted_at` column; a nightly job purges 30 days after. Hard-delete available on teacher request within 24h (GDPR/FERPA right).
- **Audit stamps.** Every LLM call writes `usage_events` with `audit_id`, `model`, `input_hash`, `output_hash`. Hashes allow after-the-fact investigation without storing the content itself.

---

## Migration plan

Supabase migration files under `supabase/migrations/`, ordered by dependency:

1. `0001_extensions.sql` — `vector`, `pgcrypto`
2. `0002_tenant.sql` — `organizations`, `teachers`, `subscriptions`
3. `0003_canvas.sql` — `canvas_credentials`, `courses`
4. `0004_ai_context.sql` — `course_contexts`, `course_embeddings` (with `ivfflat` index)
5. `0005_actions.sql` — `actions`, `action_results`
6. `0006_usage.sql` — `usage_events`
7. `0010_rls_policies.sql` — every policy above in one file, reviewable at once

Seed data for the hackathon demo lives in `supabase/seed.sql` — one test teacher, one test course on the Free-for-Teachers sandbox, and pre-chunked embeddings for a sample textbook.
