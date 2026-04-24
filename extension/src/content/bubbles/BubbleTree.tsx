// The star component. Walks the teacher through a bubble tree step by step.
// Every tap dispatches action.step to the service worker over a port,
// which streams back the next BubbleNode and re-renders.

import { useEffect, useRef, useState } from "react";
import type { BubbleNode, ActionKind } from "@/shared/messages";
import { startAction } from "@/shared/backend-client";
import { BubblePill } from "./BubblePill";
import { OtherInput } from "./OtherInput";

type Props = {
  kind: ActionKind;
  courseId: string;
  onTerminal?: (preview: unknown) => void;
};

export function BubbleTree({ kind, courseId, onTerminal }: Props) {
  const [nodes, setNodes] = useState<BubbleNode[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    void (async () => {
      const { actionId } = await startAction(kind, courseId);
      setActionId(actionId);
      const port = chrome.runtime.connect({ name: "action" });
      portRef.current = port;
      port.onMessage.addListener((m) => {
        if (m.type === "bubble") {
          setNodes((prev) => [...prev, m.node as BubbleNode]);
        } else if (m.type === "done") {
          // last node is terminal; nothing more to do
        } else if (m.type === "error") {
          console.error("[canvas-ai] bubble stream error", m.error);
        }
      });
      port.postMessage({ type: "action.step", actionId, picks: {} });
    })();
    return () => portRef.current?.disconnect();
  }, [kind, courseId]);

  const pickBubble = (stepLabel: string, pillId: string) => {
    const nextPicks = { ...picks, [stepLabel]: pillId };
    setPicks(nextPicks);
    portRef.current?.postMessage({
      type: "action.step",
      actionId,
      picks: nextPicks,
    });
  };

  return (
    <div className="canvas-ai-bubble-tree">
      {nodes.map((node, i) => (
        <div key={i} className="canvas-ai-bubble-row">
          <div className="canvas-ai-bubble-row-label">{node.label}</div>
          <div className="canvas-ai-bubble-row-pills">
            {node.options.map((pill) =>
              pill.kind === "other" ? (
                <button
                  key={pill.id}
                  className="canvas-ai-bubble canvas-ai-bubble-other"
                  onClick={() => setShowOther(true)}
                >
                  {pill.label}
                </button>
              ) : (
                <BubblePill
                  key={pill.id}
                  pill={pill}
                  onTap={() => pickBubble(node.label, pill.id)}
                />
              )
            )}
          </div>
          {node.isTerminal && onTerminal && (
            <button
              className="canvas-ai-bubble canvas-ai-bubble-generate"
              onClick={() => onTerminal(picks)}
            >
              ✨ Generate
            </button>
          )}
        </div>
      ))}
      {showOther && (
        <OtherInput
          onSubmit={(text) => {
            pickBubble("other", text);
            setShowOther(false);
          }}
          onCancel={() => setShowOther(false)}
        />
      )}
    </div>
  );
}
