// LLM router. Opus for authoring, Haiku for scale. See docs/ARCHITECTURE.md
// for the full routing table.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const MODELS = {
  opus: "claude-opus-4-7",
  haiku: "claude-haiku-4-5-20251001",
} as const;

export type ModelKey = keyof typeof MODELS;

type CallOpts = {
  model: ModelKey;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  zeroRetention?: boolean;
};

export async function callLLM(opts: CallOpts): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODELS[opts.model],
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
    // Pass a metadata tag so we can trace spend per action_kind in billing.
    metadata: { user_id: "server" },
    // TODO: when docs/contexts carry student text, also enable zero-retention
    // mode by passing extraHeaders["anthropic-disable-training"] = "true"
    // (exact header name: consult current Anthropic API docs).
  });
  const block = res.content[0];
  if (block.type !== "text") throw new Error("expected text response");
  return block.text;
}

// Route by action kind per docs/ARCHITECTURE.md#llm-routing-policy.
export function modelForAction(
  kind: string
): ModelKey {
  switch (kind) {
    case "draft_assignment":
    case "rebuild_unit":
      return "opus";
    case "bulk_feedback":
    case "risk_radar":
    case "risk_radar_classify":
    case "outreach_draft":
    case "bubble_option_gen":
    case "context_sufficiency_check":
      return "haiku";
    default:
      return "haiku";
  }
}
