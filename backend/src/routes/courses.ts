// /courses/* — list, sync, and scan courses for a teacher.

import { Hono } from "hono";
import { HttpError } from "@/lib/errors";
import { db } from "@/lib/db";
import { CanvasClient } from "@/lib/canvas";
import { requireAuth } from "@/middleware/auth";

const app = new Hono<{ Variables: { teacherId: string } }>();

app.use("*", requireAuth);

// GET /courses — list the teacher's connected courses
app.get("/", async (c) => {
  const teacherId = c.get("teacherId");
  const { data, error } = await db
    .from("courses")
    .select("id, canvas_course_id, name, term, code, enrollment_count, scan_status, last_scanned_at, quality_score")
    .eq("teacher_id", teacherId)
    .order("last_scanned_at", { ascending: false, nullsFirst: false });
  if (error) throw new HttpError(500, error.message);
  return c.json({ courses: data });
});

// POST /courses/sync — pull fresh course list from Canvas and upsert
app.post("/sync", async (c) => {
  const teacherId = c.get("teacherId");

  const { data: cred, error: cerr } = await db
    .from("canvas_credentials")
    .select("canvas_url, token_enc")
    .eq("teacher_id", teacherId)
    .single();
  if (cerr || !cred) throw new HttpError(400, "no canvas credentials");

  const tokenEnc = Uint8Array.from(
    Buffer.from(cred.token_enc as unknown as string, "base64")
  );
  const canvas = await CanvasClient.fromEncrypted(cred.canvas_url, tokenEnc);

  const list = await canvas.get<
    Array<{
      id: number;
      name: string;
      term?: { name: string };
      total_students?: number;
      course_code: string;
    }>
  >("/courses?enrollment_type=teacher&per_page=100");

  const rows = list.map((course) => ({
    teacher_id: teacherId,
    canvas_course_id: course.id,
    name: course.name,
    term: course.term?.name ?? null,
    code: course.course_code,
    enrollment_count: course.total_students ?? null,
    scan_status: "idle" as const,
  }));

  const { error: uerr } = await db
    .from("courses")
    .upsert(rows, { onConflict: "teacher_id,canvas_course_id" });
  if (uerr) throw new HttpError(500, uerr.message);

  return c.json({ synced: rows.length });
});

// POST /courses/:id/scan — kick off context ingestion (async)
app.post("/:id/scan", async (c) => {
  // TODO: enqueue background worker that:
  //   1. fetches syllabus, modules, pages, assignments, rubrics, quizzes, files
  //   2. extracts text (pdfplumber-equivalent on Bun; pdfjs-dist works)
  //   3. chunks (target 500 tokens, 50 overlap)
  //   4. calls embedding API, inserts into course_embeddings
  //   5. updates courses.scan_status = 'ready', quality_score
  const courseId = c.req.param("id");
  await db
    .from("courses")
    .update({ scan_status: "scanning" })
    .eq("id", courseId);
  return c.json({ ok: true, courseId, status: "scanning" });
});

export default app;
