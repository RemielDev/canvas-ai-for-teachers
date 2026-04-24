# Claude instructions — `extension/`

Chrome extension (Manifest V3). Primary user surface for Canvas AI.

---

## What this directory is

In-page AI for teachers, injected into Canvas LMS pages. Content scripts detect the current Canvas page, mount React bubble panels, and route all AI work through the service worker to the backend. The extension is the wedge that bypasses institutional OAuth2 approval — teachers self-onboard with a PAT in two minutes.

For the full design, read [`../docs/EXTENSION.md`](../docs/EXTENSION.md). For overall system context, read [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## Stack

- Vite 5 + CRXJS 2 (beta) — build + HMR into unpacked Chrome
- React 18 with `react-jsx` runtime
- TypeScript strict, path alias `@/*` → `src/*`
- Zod at every `chrome.runtime.sendMessage` boundary
- Tailwind 3 with a `canvas-ai-` class prefix to avoid Canvas style collisions

---

## Commands

```bash
pnpm install
pnpm dev        # HMR-watch into extension/dist
pnpm build      # production bundle for Chrome Web Store
pnpm typecheck  # tsc --noEmit
pnpm test:e2e   # Playwright against Free-for-Teachers sandbox
```

First-time load: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `extension/dist/`. After that, `pnpm dev` auto-reloads on save. Service-worker changes still require a manual "Reload" in `chrome://extensions`.

---

## File layout

- `src/manifest.ts` — CRXJS-style manifest (TypeScript, not JSON). Edit here to change permissions, content scripts, or background worker.
- `src/background/service_worker.ts` — long-lived broker. Listens on a port named `"action"`. Streams `BubbleNode`s from backend SSE back to the content UI.
- `src/content/mount.ts` — the router. Detects the current Canvas page by URL pattern and lazy-imports the matching target injector.
- `src/content/bubbles/` — `BubbleTree`, `BubblePill`, `OtherInput`. This is the star UI primitive.
- `src/content/targets/` — one file per Canvas page we inject into. Add a new target here and register it in `mount.ts`.
- `src/popup/` — toolbar popup. Quick-actions surface. Keep it small.
- `src/options/` — settings. **The only screen in the entire product where the teacher types.** Canvas URL + PAT, exchanged once for a JWT.
- `src/shared/` — cross-context code:
  - `messages.ts` — Zod schemas for every `chrome.runtime` message type. Source of truth. Backend's `BubbleNode` schema must stay in sync with this file.
  - `storage.ts` — typed `chrome.storage.local` wrapper. Only keys that are safe to persist client-side go here.
  - `canvas-client.ts` — fetch helpers for `*.instructure.com/api/v1/*`. Always uses `credentials: 'include'`. No token handoff.
  - `backend-client.ts` — fetch helpers for `api.canvasai.app`. Attaches JWT. SSE streaming generator.

---

## Conventions

- **Never store PAT plaintext.** The PAT is sent once to `/auth/connect` and thrown away. Backend KMS-wraps it. Extension only holds the JWT + rotating refresh token.
- **Never store student PII.** Names, emails, submission text, grades — none of it goes into `chrome.storage` or IndexedDB.
- **Never `eval`, never inject remote scripts.** Manifest V3 forbids it and Chrome Web Store review will reject.
- **Always validate messages at the boundary** with Zod (`Msg.parse` or `Msg.safeParse`). Never trust the shape of a message received from the other context.
- **Use `credentials: 'include'` for every Canvas API call.** Never `Authorization: Bearer <pat>` from the client.
- **Prefix CSS classes with `canvas-ai-`** so we never collide with Canvas's styles. Tailwind utilities are fine too but the top-level class on every injected root should be scoped.
- **Test with the Free-for-Teachers sandbox.** Never use a real teacher account with real students for development.

---

## Adding a new injection target

1. Create `src/content/targets/<name>.tsx`. Export a default React component.
2. Add a URL pattern to `detectTarget()` in `src/content/mount.ts`.
3. Add the lazy-import branch in `mount.ts`.
4. Style it via scoped `.canvas-ai-<name>` classes in `src/styles.css`.
5. Write a Playwright e2e test under `tests/` that navigates to that Canvas URL and asserts the trigger renders.

---

## Adding a new AI action

1. Add the new kind to `ActionKind` in `src/shared/messages.ts`.
2. Backend registers the same kind in its action router (`backend/src/routes/actions.ts`).
3. In the relevant target component, pass `kind="<new_kind>"` to `<BubbleTree>`.
4. The bubble tree walks itself — the backend returns `BubbleNode`s, so no additional client code needed unless the terminal preview needs custom rendering (then handle in the `onTerminal` callback).

---

## What NOT to do

- Don't fight Canvas's DOM. If Canvas ships a DOM change that breaks a selector, update the target — don't try to be too clever with MutationObserver.
- Don't add `<all_urls>` or `tabs` permission. If you think you need them, you don't.
- Don't render the bubble UI inside an `<iframe>` or Shadow DOM "just in case" — `canvas-ai-` prefixing is enough and keeps debugging sane.
- Don't reach into Canvas's React state. We treat Canvas as a black box and communicate only through its REST API + the DOM.
- Don't bundle the Anthropic SDK into the extension. All LLM work goes through the backend.

---

## Environment variables

Set in `.env` (local) or via Vite's `import.meta.env`:

- `VITE_BACKEND_URL` — defaults to `https://api.canvasai.app`. Override to `http://localhost:8787` during local dev.

`.env.test` holds FFT sandbox credentials for Playwright and is git-ignored.
