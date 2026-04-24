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

export const ActionKind = z.enum([
  "draft_assignment",
  "rebuild_unit",
  "risk_radar",
  "bulk_feedback",
  "custom",
]);
export type ActionKind = z.infer<typeof ActionKind>;

export const ActionStartMsg = z.object({
  type: z.literal("action.start"),
  kind: ActionKind,
  courseId: z.string().uuid(),
});

export const ActionStepMsg = z.object({
  type: z.literal("action.step"),
  actionId: z.string().uuid(),
  picks: z.record(z.string(), z.string()),
});

export const ActionResultMsg = z.object({
  type: z.literal("action.result"),
  actionId: z.string().uuid(),
  preview: z.unknown(),
});

export const Msg = z.discriminatedUnion("type", [
  ActionStartMsg,
  ActionStepMsg,
  ActionResultMsg,
]);
export type Msg = z.infer<typeof Msg>;
