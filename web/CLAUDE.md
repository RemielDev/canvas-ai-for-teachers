# Claude instructions — `web/`

Next.js 15 app-router dashboard. Depth surface for cross-course work that doesn't fit in a bubble panel.

---

## What this directory is

The web dashboard at `canvasai.app`. It's the depth surface — multi-course analytics, scheduled unit rebuilds, admin controls (district tier), billing. The Chrome extension stays in-page for single-course work; the site is where teachers go when they want to see everything at once.

For full system context: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md). Database schema: [`../docs/DATABASE.md`](../docs/DATABASE.md).

---

## Stack

- Next.js 15 app router with `typedRoutes`
- React 18, Server Components by default; `"use client"` only where needed (forms, realtime)
- Tailwind 3 with a `brand-*` color extension mapping to the palette
- `tailwindcss-animate` + shadcn/ui patterns (install components on demand via `pnpm dlx shadcn@latest add`)
- Supabase: `@supabase/ssr` for auth + RLS, `@supabase/supabase-js` for data
- React Query for server state on client components
- Zod at API route boundaries
- `lucide-react` for icons

---

## Commands

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build
pnpm start
pnpm typecheck
pnpm lint
```

---

## File layout

- `src/app/` — App Router pages (Server Components by default)
  - `page.tsx` — landing/marketing
  - `connect/page.tsx` — **the only typed page.** Canvas URL + PAT form.
  - `dashboard/page.tsx` — cross-course dashboard
  - `api/connect/route.ts` — POST proxy to backend `/auth/connect`, sets http-only JWT cookie
  - `layout.tsx` — root layout with `<Providers>`
  - `providers.tsx` — React Query provider (client component)
  - `globals.css` — Tailwind base + app-wide tokens
- `src/lib/`
  - `supabase.ts` — browser and server Supabase clients (SSR pattern)
  - `utils.ts` — `cn()` for conditional Tailwind classes

---

## Conventions

- **Server Components by default.** Fetch in the component. Mark `"use client"` only when you need state, effects, or browser APIs.
- **API routes handle secrets, not the client.** The PAT and JWT never show up in browser JS. The `api/connect` route is the pattern — proxy to backend, set http-only cookie, return.
- **RLS does auth.** Supabase client-side queries rely on RLS policies; don't write per-route auth checks on top.
- **Bubble-first applies here too.** Every dashboard interaction should be tap-only where possible. When a text field is unavoidable, mirror the extension's `✏ Other…` pattern and flag a quality warning.
- **Cookies:** `canvas_ai_jwt` (15-min TTL) and `canvas_ai_refresh` (30-day). Both http-only, `sameSite: 'lax'`, `secure` in production.
- **Path alias:** `@/*` → `./src/*`.

---

## Adding a new page

1. Create `src/app/<route>/page.tsx`. Server Component by default.
2. If it needs data, `fetch` or query Supabase directly inside the component.
3. Add navigation entry to the dashboard shell (TODO: build `DashboardShell` layout component once there are 3+ pages).
4. For forms, create a client component child; keep data fetching on the server parent.

---

## Adding a shadcn component

```bash
pnpm dlx shadcn@latest add button card dialog
```

Components land in `src/components/ui/`. `cn()` from `@/lib/utils` is the class-merging helper they expect.

---

## What NOT to do

- Don't duplicate the bubble tree component from the extension. The dashboard uses different interactions; if a true bubble tree is needed on the site, share the backend schema (`BubbleNode`) and build a separate React component that calls the same `/actions/:id/step` endpoint.
- Don't store JWT in localStorage. Http-only cookies only.
- Don't call the backend from the client with a raw PAT. Always go through an API route.
- Don't bypass RLS — if a query feels like it needs service-role, you probably need a different policy.

---

## Environment variables

`.env.local` (git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
BACKEND_URL=http://localhost:8787
```

Production vars live in Vercel. Never check `.env.local` into git.
