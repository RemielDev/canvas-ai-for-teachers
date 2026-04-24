// /actions/* — start an action, walk the bubble tree, stream BubbleNodes back.
// See docs/ARCHITECTURE.md#data-flow--draft-assignment-end-to-end for the shape.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { db } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";
import type { BubbleNode } from "@/types/bubble";

const app = new Hono<{ Variables: { teacherId: string } }>();

app.use("*", requireAuth);

const StartBody = z.object({
  kind: z.enum([
    "draft_assignment",
    "rebuild_unit",
    "risk_radar",
    "bulk_feedback",
    "custom",
  ]),
  course_id: z.string().uuid(),
});

app.post("/start", async (c) => {
  const teacherId = c.get("teacherId");
  const body = StartBody.parse(await c.req.json());
  const { data, error } = await db
    .from("actions")
    .insert({
      teacher_id: teacherId,
      course_id: body.course_id,
      kind: body.kind,
      inputs_jsonb: {},
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw new HttpError(500, "action create failed");
  return c.json({ actionId: data.id });
});

const StepBody = z.object({
  picks: z.record(z.string(), z.string()),
});

// SSE endpoint: streams BubbleNodes as the tree unfolds.
app.post("/:id/step", async (c) => {
  const teacherId = c.get("teacherId");
  const actionId = c.req.param("id");
  const body = StepBody.parse(await c.req.json());

  // Accumulate picks onto the action row so we can replay.
  const { data: row, error: gerr } = await db
    .from("actions")
    .select("id, kind, course_id, inputs_jsonb, teacher_id")
    .eq("id", actionId)
    .single();
  if (gerr || !row) throw new HttpError(404, "action not found");
  if (row.teacher_id !== teacherId) throw new HttpError(403, "forbidden");

  const merged = { ...(row.inputs_jsonb ?? {}), ...body.picks };
  await db.from("actions").update({ inputs_jsonb: merged }).eq("id", actionId);

  return streamSSE(c, async (stream) => {
    // TODO: real implementation — walk the per-kind bubble-tree schema,
    // call the LLM for option generation at each step, emit BubbleNodes.
    // Placeholder single-node response so the extension can smoke-test the wire.
    const node: BubbleNode = {
      label: `Next step for ${row.kind}`,
      options: [
        { id: "a", label: "Option A", kind: "option", selected: false },
        { id: "b", label: "Option B", kind: "option", selected: false },
        { id: "other", label: "✏ Other…", kind: "other", selected: false },
      ],
      requiresContext: [],
      isTerminal: false,
    };
    await stream.writeSSE({ data: JSON.stringify(node) });
  });
});

export default app;
