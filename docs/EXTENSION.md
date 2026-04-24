# Chrome Extension

Manifest V3 extension that injects AI affordances directly into Canvas pages. This is the primary user surface and the wedge that bypasses institutional OAuth2 approval.

See also: [Architecture](./ARCHITECTURE.md) · [Database](./DATABASE.md) · [README](../README.md)

---

## Overview

- **Runtime target:** Canvas LMS pages under `*.instructure.com`
- **Platform:** Chromium-based browsers (Chrome, Edge, Brave, Arc). Firefox port is post-hackathon.
- **Manifest version:** 3 (required by Chrome Web Store as of 2024)
- **Stack:** Vite + CRXJS · React 18 · TypeScript strict · Zod for message validation · Tailwind + shadcn/ui for bubble components
- **Build output:** Unpacked extension in `extension/dist/`, zipped for Chrome Web Store upload

---

## File structure

```
extension/
├─ manifest.json                 v3 · permissions listed below
├─ vite.config.ts                CRXJS plugin · HMR · TS strict
├─ package.json
├─ tsconfig.json
├─ tailwind.config.ts
├─ src/
│   ├─ background/
│   │   └─ service_worker.ts     long-lived broker: auth, API calls, SSE stream
│   ├─ content/
│   │   ├─ mount.ts              page-type detect, React root mounting
│   │   ├─ bubbles/
│   │   │   ├─ BubbleTree.tsx    the star component
│   │   │   ├─ BubblePill.tsx    individual bubble
│   │   │   └─ OtherInput.tsx    the ✏ Other… fallback — only typing path
│   │   └─ targets/              per-page injectors
│   │       ├─ assignment-editor.tsx
│   │       ├─ speedgrader.tsx
│   │       ├─ gradebook.tsx
│   │       ├─ course-home.tsx
│   │       └─ module-view.tsx
│   ├─ popup/
│   │   └─ Popup.tsx             toolbar popup: quick actions, class picker
│   ├─ options/
│   │   └─ Options.tsx           settings: Canvas URL, PAT, sign-out
│   └─ shared/
│       ├─ canvas-client.ts      fetch /api/v1/* with credentials:'include'
│       ├─ backend-client.ts     fetch api.canvasai.app with JWT
│       ├─ messages.ts           typed chrome.runtime contracts (Zod)
│       ├─ storage.ts            chrome.storage + IndexedDB wrapper
│       └─ bubble-spec.ts        shared BubbleNode schema with backend
├─ public/
│   └─ icons/                    16/32/48/128 PNG
└─ tests/                        Playwright e2e against FFT sandbox
```

---

## `manifest.json`

Minimal surface. Every permission has to justify itself to Chrome Web Store review and to the teacher seeing the install prompt.

```json
{
  "manifest_version": 3,
  "name": "Canvas AI for Teachers",
  "version": "0.1.0",
  "description": "AI workflows inside your Canvas course. Draft assignments, rebuild units, surface at-risk students — all with a tap.",
  "icons": {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png"
  },
  "action": { "default_popup": "popup/index.html" },
  "options_page": "options/index.html",
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://*.instructure.com/*",
    "https://api.canvasai.app/*"
  ],
  "externally_connectable": {
    "matches": ["https://*.canvasai.app/*"]
  },
  "content_scripts": [
    {
      "matches": ["https://*.instructure.com/*"],
      "js": ["src/content/mount.ts"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "src/background/service_worker.ts",
    "type": "module"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Permissions rationale** (for Chrome Web Store review):

- `storage` — cache course list, session JWT, per-teacher settings.
- `activeTab` — inject into the currently-focused Canvas tab on user gesture; no broader tab access.
- `host_permissions` for `*.instructure.com` — required to call Canvas's REST API from the background worker on the teacher's behalf.
- `host_permissions` for `api.canvasai.app` — our own backend.
- `externally_connectable` — only our own web app can `chrome.runtime.sendMessage` to the extension (for the OAuth redirect handoff on Pro tier).
- **Not requested:** `<all_urls>`, `cookies`, `webRequest`, `tabs`, `identity`. None are needed.

---

## Message flow

Every user tap walks a 5-step loop.

```
① Teacher taps a bubble
   content/bubbles/BubbleTree.tsx     →    dispatch  ACTION_STEP

② chrome.runtime.sendMessage({ type: 'action.step', actionId, picks })
   content script   →   service worker
   typed + Zod-validated via shared/messages.ts

③ service worker
   • reads/writes chrome.storage (cache, JWT)
   • fetches Canvas /api/v1/* with credentials:'include'
     (session cookie authorizes — no token handoff from page context)
   • POSTs to backend /actions/:id/step with JWT
     → backend retrieves from pgvector, calls LLM

④ Backend returns the NEXT BubbleNode  (or final result)
   shape:  { label, options: BubblePill[], requiresContext: string[] }
   streams via Server-Sent Events
   service worker pipes through port.postMessage

⑤ BubbleTree re-renders with the next row
   at terminal step:
     preview  →  [Push to Canvas] [Regenerate] [Tweak tone] [✏ Other…]
     Push to Canvas writes via  PUT /api/v1/courses/:id/assignments/:aid
```

### Typed message shapes

`src/shared/messages.ts` — the single source of truth for content ↔ service-worker messaging. Every dispatch and every listener uses Zod at the boundary.

```ts
import { z } from "zod";

export const BubblePill = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  selected: z.boolean().default(false),
  kind: z.enum(["option", "other", "terminal"]),
});
export type BubblePill = z.infer<typeof BubblePill>;

export const BubbleNode = z.object({
  label: z.string(),
  options: z.array(BubblePill),
  requiresContext: z.array(z.string()).default([]),
  isTerminal: z.boolean().default(false),
});
export type BubbleNode = z.infer<typeof BubbleNode>;

export const ActionStepMsg = z.object({
  type: z.literal("action.step"),
  actionId: z.string().uuid(),
  picks: z.record(z.string(), z.string()), // step label → pill id
});

export const ActionStartMsg = z.object({
  type: z.literal("action.start"),
  kind: z.enum([
    "draft_assignment", "rebuild_unit",
    "risk_radar", "bulk_feedback", "custom",
  ]),
  courseId: z.string().uuid(),
});

export const ActionResultMsg = z.object({
  type: z.literal("action.result"),
  actionId: z.string().uuid(),
  preview: z.unknown(), // kind-specific; each target validates
});

export const Msg = z.discriminatedUnion("type", [
  ActionStartMsg, ActionStepMsg, ActionResultMsg,
]);
export type Msg = z.infer<typeof Msg>;
```

### Service worker pattern (SSE to port)

Long-running AI calls stream back via a `chrome.runtime.Port` rather than a single `sendResponse`, so the UI can update incrementally.

```ts
// src/background/service_worker.ts
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "action") return;

  port.onMessage.addListener(async (raw) => {
    const msg = Msg.parse(raw);
    if (msg.type !== "action.step") return;

    const res = await fetch(
      `https://api.canvasai.app/actions/${msg.actionId}/step`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await getJwt()}`,
        },
        body: JSON.stringify({ picks: msg.picks }),
      }
    );

    // SSE: read chunks, post each BubbleNode as it arrives
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value).split("\n\n")) {
        if (!line.startsWith("data: ")) continue;
        const node = BubbleNode.parse(JSON.parse(line.slice(6)));
        port.postMessage({ type: "bubble", node });
      }
    }
    port.postMessage({ type: "done" });
  });
});
```

---

## Injection targets

Each target is a React component rendered at a specific DOM node on a specific Canvas URL pattern. `content/mount.ts` routes based on `location.pathname`.

### Assignment editor — `/courses/:id/assignments/:aid/edit`

- **Inject:** `✨ AI draft` button next to the native Save
- **Bubble tree:** unit → type → level → length → Generate → preview
- **DOM target:** `div#edit_assignment_form` — mount a sibling above the submit bar

### SpeedGrader — `/courses/:id/gradebook/speed_grader`

- **Inject:** slide-out drawer titled "Rubric-locked bulk feedback"
- **Bubble tree:** pick rubric criterion → pick student subset → Generate → per-student preview
- **DOM target:** sibling of `div#rubric_holder`

### Gradebook — `/courses/:id/gradebook`

- **Inject:** floating badge "⚠ N at-risk students — tap to open radar"
- **Bubble tree:** pick student → pick intervention type (outreach email / differentiated assignment / parent message) → Generate
- **DOM target:** top of `div.gradebook`, `position: fixed`

### Course home — `/courses/:id`

- **Inject:** fixed floating action button, bottom-right: "🛠 Rebuild unit"
- **Bubble tree:** pick unit → scope (expand / replace / realign) → standards → Generate
- **DOM target:** `body`, fixed-position FAB

### Module view — `/courses/:id/modules`

- **Inject:** inline per-module action: "🔧 AI-organize"
- **Bubble tree:** reorder items / align to standards / add quiz / add recap page
- **DOM target:** header action inside each `div.context_module_items`

---

## Auth & token handling

The extension never holds a Canvas PAT or OAuth2 refresh token long-term.

### Onboarding (one-time)

1. Options page collects Canvas URL + PAT.
2. Extension POSTs `{ canvas_url, pat }` to `https://api.canvasai.app/auth/connect` over HTTPS.
3. Backend verifies the PAT by calling `GET /users/self` on the teacher's Canvas. If valid, it:
   - KMS-encrypts the PAT and stores in `canvas_credentials.token_enc`
   - Creates/updates the `teachers` row
   - Returns `{ jwt, refresh_token, teacher_id }`
4. Extension stores `jwt` and `refresh_token` in `chrome.storage.local`. **PAT is not persisted in the extension.**

### Runtime

- **Canvas calls** from the service worker or content script use `credentials: 'include'` against `*.instructure.com` — the teacher's existing Canvas session cookie authorizes reads/writes. No token in flight from the client.
- **Backend calls** from the service worker attach `Authorization: Bearer ${jwt}`. JWT TTL is 15 minutes; refresh uses `refresh_token` rotated on each use.
- **Sign-out** clears `chrome.storage.local`, clears IndexedDB, and POSTs `/auth/signout` to revoke the refresh token server-side.

### OAuth2 (paid tier)

Same flow, different entry point. Options page links to `https://api.canvasai.app/auth/oauth/start?canvas_url=...`. Backend handles the Canvas OAuth redirect dance, stores the refresh token KMS-encrypted, and returns the extension's own `jwt` + `refresh_token`. The extension never sees the Canvas OAuth tokens directly.

---

## Security posture

- **Manifest V3.** No remote code execution. No `eval`. No inline `<script>` tags. CSP enforced by the browser.
- **Minimal permissions.** Only `storage`, `activeTab`, and two host patterns. No `<all_urls>`, no `cookies`, no `webRequest`.
- **No PAT in extension.** Exchanged once for a short-lived JWT + rotating refresh token. Both live in `chrome.storage.local`, wiped on sign-out.
- **Canvas session cookie, not token.** All page-context Canvas API calls use `credentials: 'include'` so we piggy-back on the teacher's logged-in session. No token leaks into page memory.
- **Typed message boundary.** `chrome.runtime.sendMessage` dispatches are Zod-validated on both send and receive. Unknown message types are dropped.
- **`externally_connectable` scoped.** Only our own web origin can message the extension. This is needed for the OAuth redirect handoff and nothing else.
- **IndexedDB TTL.** Cached course lists and recent bubble trees expire after 7 idle days. Teacher-initiated sign-out or Chrome's "Remove" flow wipes state immediately.
- **No telemetry with content.** Analytics events carry `event_type`, `action_kind`, `duration_ms`, `model`, and hashes. No prompts, no completions, no student-authored text.
- **No student PII cached.** Submission text, names, emails, photos, and SIS IDs never hit `chrome.storage` or IndexedDB. Bulk-feedback workflows render server-streamed previews and clear them on exit.

---

## Build & dev loop

**Install:**

```bash
cd extension
pnpm install
```

**Dev (HMR into Chrome):**

```bash
pnpm dev
```

`vite-plugin-crx` watches the source, rebuilds `dist/`, and Chrome auto-reloads the extension. Changes to content scripts refresh the injected panel on navigation; changes to the service worker require a manual "Reload" in `chrome://extensions`.

**Load unpacked (first-time setup):**

1. Chrome → `chrome://extensions` → enable Developer mode
2. Click "Load unpacked"
3. Select `extension/dist/`
4. Pin the extension to the toolbar

**Build for upload:**

```bash
pnpm build
# produces extension/dist/ and extension/canvas-ai.zip
```

**E2E tests:**

```bash
pnpm test:e2e
# Playwright drives a real Chrome with the extension loaded,
# logs into a Free-for-Teachers sandbox (canvas.instructure.com),
# walks each injection target and one bubble tree end-to-end.
```

FFT sandbox credentials live in `.env.test` (git-ignored) and in CI secrets.

---

## Publishing

Chrome Web Store submission checklist (post-hackathon):

- [ ] Icons in 16 / 32 / 48 / 128 px PNG
- [ ] Store listing: short description (~132 chars), long description, 5 screenshots (1280×800), promo tile
- [ ] Privacy policy at `https://canvasai.app/privacy` — FERPA-compliant, covers PAT handling, zero-retention, data deletion
- [ ] Single purpose statement: "AI-assisted content authoring and grading for Canvas LMS teachers"
- [ ] Justification for each requested permission and host permission
- [ ] Demo video (30–60s) showing onboarding + one hero feature end-to-end
- [ ] Test account credentials for reviewers (FFT sandbox with a populated demo class)
- [ ] Source code availability statement (if requested — we're not obfuscated; Vite's output is readable)
