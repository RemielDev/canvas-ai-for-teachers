"""Generate docs/QUICKSTART.pdf — a one-page cheat sheet explaining what each
workspace is, how to run it, how they talk to each other, and a small diagram.

Re-run after changes:  python scripts/make_quickstart_pdf.py
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent.parent / "docs" / "QUICKSTART.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = LETTER  # 612 x 792 pt

# Palette (lifted from the Excalidraw diagrams for consistency)
C_TITLE = HexColor("#1e40af")
C_SUBTITLE = HexColor("#3b82f6")
C_BODY = HexColor("#1f2937")
C_MUTED = HexColor("#64748b")
C_LINE = HexColor("#cbd5e1")

C_EXT_FILL = HexColor("#dbeafe")
C_EXT_STROKE = HexColor("#1e40af")
C_WEB_FILL = HexColor("#ddd6fe")
C_WEB_STROKE = HexColor("#6d28d9")
C_BACK_FILL = HexColor("#fef3c7")
C_BACK_STROKE = HexColor("#b45309")
C_DB_FILL = HexColor("#a7f3d0")
C_DB_STROKE = HexColor("#047857")
C_EXT_CANVAS_FILL = HexColor("#fed7aa")
C_EXT_CANVAS_STROKE = HexColor("#c2410c")


def draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, width: float,
                 leading: float = 11, font: str = "Helvetica",
                 size: int = 9, color: HexColor = C_BODY) -> float:
    """Draw wrapped text, return the y coordinate below the last line."""
    c.setFillColor(color)
    c.setFont(font, size)
    cur_y = y
    for paragraph in text.split("\n"):
        words = paragraph.split()
        line = ""
        while words:
            trial = f"{line} {words[0]}".strip()
            if c.stringWidth(trial, font, size) <= width:
                line = trial
                words.pop(0)
            else:
                c.drawString(x, cur_y, line)
                cur_y -= leading
                line = ""
        if line:
            c.drawString(x, cur_y, line)
            cur_y -= leading
        if not paragraph:
            cur_y -= leading / 2
    return cur_y


def box(c: canvas.Canvas, x: float, y: float, w: float, h: float,
        fill: HexColor, stroke: HexColor, label: str,
        sub: str | None = None) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 6, stroke=1, fill=1)
    c.setFillColor(stroke)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(x + w / 2, y + h - 14, label)
    if sub:
        c.setFont("Helvetica", 8)
        c.setFillColor(C_BODY)
        c.drawCentredString(x + w / 2, y + h - 26, sub)


def arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float,
          color: HexColor = C_MUTED, label: str | None = None,
          bidirectional: bool = False) -> None:
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.3)
    c.line(x1, y1, x2, y2)
    # arrow head at end
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    head = 6
    for sign in (-1, 1):
        hx = x2 - head * math.cos(angle - sign * 0.5)
        hy = y2 - head * math.sin(angle - sign * 0.5)
        c.line(x2, y2, hx, hy)
    if bidirectional:
        for sign in (-1, 1):
            hx = x1 + head * math.cos(angle - sign * 0.5)
            hy = y1 + head * math.sin(angle - sign * 0.5)
            c.line(x1, y1, hx, hy)
    if label:
        c.setFont("Helvetica", 7)
        c.setFillColor(C_MUTED)
        c.drawString((x1 + x2) / 2 + 4, (y1 + y2) / 2 + 3, label)


def section_rule(c: canvas.Canvas, y: float, title: str) -> float:
    c.setFillColor(C_SUBTITLE)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(36, y, title)
    c.setStrokeColor(C_LINE)
    c.setLineWidth(0.6)
    c.line(36, y - 4, W - 36, y - 4)
    return y - 16


def build(c: canvas.Canvas) -> None:
    # ─── Header ────────────────────────────────────────────────────
    c.setFillColor(C_TITLE)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(36, H - 48, "Canvas AI for Teachers — Quick Reference")

    c.setFillColor(C_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(
        36, H - 62,
        "Chrome extension + web dashboard + backend, one shared Supabase + pgvector store. Hackathon build, LA Hacks 2026.",
    )

    # ─── Section 1: What each workspace is ────────────────────────
    y = section_rule(c, H - 90, "01  What's in each workspace")

    col_w = (W - 72 - 24) / 3
    col1_x = 36
    col2_x = col1_x + col_w + 12
    col3_x = col2_x + col_w + 12

    def column(x: float, title: str, sub: str, bullets: list[str]) -> None:
        c.setFillColor(C_TITLE)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y, title)
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(C_MUTED)
        c.drawString(x, y - 11, sub)
        yy = y - 24
        c.setFillColor(C_BODY)
        c.setFont("Helvetica", 8.5)
        for b in bullets:
            yy = draw_wrapped(c, "• " + b, x, yy, col_w, leading=10, size=8.5)
            yy -= 1

    column(
        col1_x, "extension/", "Chrome extension (Vite + CRXJS + React)",
        [
            "Injects AI bubble panels into Canvas pages — assignment editor, SpeedGrader, gradebook, course home, module view.",
            "Uses the teacher's Canvas session cookie (credentials: 'include'), no PAT in the extension at runtime.",
            "Tap-only UX. The only typed screen is Options — paste Canvas URL + PAT once.",
            "Talks to backend via JWT; streams BubbleNodes over a chrome.runtime Port.",
        ],
    )
    column(
        col2_x, "web/", "Next.js 15 dashboard",
        [
            "Landing page, /connect form, /dashboard with multi-course overview.",
            "/connect is the only typed page — forwards PAT to backend, sets http-only JWT cookie.",
            "Server Components by default; React Query + Supabase SSR for data.",
            "For depth workflows: cross-course analytics, scheduled rebuilds, admin.",
        ],
    )
    column(
        col3_x, "backend/", "Hono on Bun",
        [
            "Auth: verifies PAT, KMS-wraps it, mints JWT. Never gives PAT back.",
            "Canvas proxy with per-URL semaphore + 403 backoff.",
            "LLM router: Opus for authoring, Haiku for scale tasks.",
            "Retrieval: pgvector top-k cosine over course_embeddings.",
            "Actions: SSE streams BubbleNode → next bubble → terminal preview.",
        ],
    )

    # ─── Section 2: Diagram ───────────────────────────────────────
    y = section_rule(c, H - 300, "02  How they fit together")

    dx = 36
    dy_top = y - 4            # top of drawing area
    dy_bot = dy_top - 170     # bottom of drawing area

    # Five boxes:
    #   left column:  Chrome Ext (upper),  Web (lower)
    #   center:       Backend (centered vertically)
    #   right column: Canvas (upper),  Supabase (middle),  Claude LLM (lower)

    bw = 120
    bh = 36

    ext_box = (dx + 10,          dy_top - bh - 6,         bw, bh)
    web_box = (dx + 10,          dy_top - bh - 6 - 68,    bw, bh)

    backend_box = (dx + 215,     dy_top - 98,             bw + 10, bh + 14)

    canvas_box = (dx + 400,      dy_top - bh - 6,         bw, bh)
    supabase_box = (dx + 400,    dy_top - bh - 6 - 50,    bw, bh)
    llm_box = (dx + 400,         dy_top - bh - 6 - 100,   bw, bh)

    box(c, *ext_box, C_EXT_FILL, C_EXT_STROKE, "Chrome Extension",
        "injected into Canvas pages")
    box(c, *web_box, C_WEB_FILL, C_WEB_STROKE, "Web Dashboard",
        "Next.js 15 app router")
    box(c, *backend_box, C_BACK_FILL, C_BACK_STROKE, "Backend",
        "Hono on Bun  ·  JWT  ·  LLM router")
    box(c, *canvas_box, C_EXT_CANVAS_FILL, C_EXT_CANVAS_STROKE, "Canvas API",
        "api.instructure.com")
    box(c, *supabase_box, C_DB_FILL, C_DB_STROKE, "Supabase",
        "Postgres + pgvector")
    box(c, *llm_box, C_WEB_FILL, C_WEB_STROKE, "Claude LLM",
        "Opus 4.7 · Haiku 4.5")

    def right_mid(b): return (b[0] + b[2], b[1] + b[3] / 2)
    def left_mid(b):  return (b[0], b[1] + b[3] / 2)

    ex, ey = right_mid(ext_box)
    wx, wy = right_mid(web_box)
    bx_l, by_l = left_mid(backend_box)
    bx_r, by_r = right_mid(backend_box)
    cx, cy = left_mid(canvas_box)
    sx, sy = left_mid(supabase_box)
    lx, ly = left_mid(llm_box)

    arrow(c, ex + 2, ey, bx_l - 2, by_l + 10, bidirectional=True,
          label="JWT · SSE")
    arrow(c, wx + 2, wy, bx_l - 2, by_l - 10, bidirectional=True,
          label="JWT")
    arrow(c, bx_r + 2, by_r + 6, cx - 2, cy, label="REST + PAT")
    arrow(c, bx_r + 2, by_r,     sx - 2, sy, bidirectional=True,
          label="SQL + pgvector")
    arrow(c, bx_r + 2, by_r - 6, lx - 2, ly, label="LLM")

    # Side note: Extension can also call Canvas directly with session cookie
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(C_MUTED)
    c.drawString(dx + 10, dy_bot + 6,
                 "Extension can also call Canvas REST directly from the page "
                 "(credentials: 'include') — used for writes that must carry "
                 "the teacher's session, e.g. Push-to-Canvas.")

    # ─── Section 3: How to run ────────────────────────────────────
    y = section_rule(c, dy_bot - 12, "03  How to run  (three terminals)")

    c.setFont("Courier", 8.5)
    c.setFillColor(C_BODY)
    cmds = [
        "# one-time",
        "cp .env.example .env    # fill SUPABASE_*, ANTHROPIC_API_KEY, JWT_SECRET",
        "",
        "# Terminal 1 — backend (http://localhost:8787)",
        "cd backend && bun install && bun run dev",
        "",
        "# Terminal 2 — web (http://localhost:3000)",
        "cd web && pnpm install && pnpm dev",
        "",
        "# Terminal 3 — extension (builds into extension/dist/)",
        "cd extension && pnpm install && pnpm dev",
        "# then: chrome://extensions → Developer mode → Load unpacked → extension/dist",
    ]
    yy = y
    for line in cmds:
        c.drawString(44, yy, line)
        yy -= 10

    # ─── Section 4: How it works together ─────────────────────────
    y = section_rule(c, yy - 6, "04  One happy-path flow  (Draft an assignment)")

    flow = (
        "1) Teacher taps \"✨ AI draft\" the extension injected next to Save.   "
        "2) Bubble tree asks unit → type → level → length (each row pre-computed by the LLM from class context).   "
        "3) Each tap → chrome.runtime.sendMessage → backend /actions/:id/step → pgvector retrieves top-k relevant chunks → "
        "Claude returns the next BubbleNode, streamed back over SSE.   "
        "4) On ✨ Generate, Opus writes the full assignment. Teacher sees a preview diff.   "
        "5) Tap \"Push to Canvas\" → extension writes via Canvas REST with the teacher's session cookie. "
        "✏ Other… is the only fallback to typing after onboarding — reserved for the ~5% edge case nothing else covers."
    )
    draw_wrapped(c, flow, 36, y, W - 72, leading=10.5, size=9)


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=LETTER)
    c.setTitle("Canvas AI for Teachers — Quick Reference")
    c.setAuthor("LA Hacks 2026")
    build(c)
    c.showPage()
    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
