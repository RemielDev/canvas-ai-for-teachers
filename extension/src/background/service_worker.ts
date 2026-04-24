// Long-lived broker. Content scripts connect via port.
// Pipes backend SSE streams back to the content UI.
// See docs/EXTENSION.md#message-flow for the full contract.

import { Msg } from "@/shared/messages";
import { streamActionStep } from "@/shared/backend-client";

chrome.runtime.onInstalled.addListener(() => {
  console.log("[canvas-ai] service worker installed");
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "action") return;

  port.onMessage.addListener(async (raw) => {
    const parsed = Msg.safeParse(raw);
    if (!parsed.success) {
      port.postMessage({ type: "error", error: "invalid message shape" });
      return;
    }
    const msg = parsed.data;
    if (msg.type !== "action.step") return;

    try {
      for await (const node of streamActionStep(msg.actionId, msg.picks)) {
        port.postMessage({ type: "bubble", node });
      }
      port.postMessage({ type: "done" });
    } catch (err) {
      port.postMessage({
        type: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
});
