// Shared schema with extension/src/shared/messages.ts.
// If you change one, change both.

import { z } from "zod";

export const BubblePillSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  selected: z.boolean().default(false),
  kind: z.enum(["option", "other", "terminal"]),
});
export type BubblePill = z.infer<typeof BubblePillSchema>;

export const BubbleNodeSchema = z.object({
  label: z.string(),
  options: z.array(BubblePillSchema),
  requiresContext: z.array(z.string()).default([]),
  isTerminal: z.boolean().default(false),
});
export type BubbleNode = z.infer<typeof BubbleNodeSchema>;

export const ActionKindSchema = z.enum([
  "draft_assignment",
  "rebuild_unit",
  "risk_radar",
  "bulk_feedback",
  "custom",
]);
export type ActionKind = z.infer<typeof ActionKindSchema>;
