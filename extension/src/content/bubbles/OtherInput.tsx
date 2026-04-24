// The only typing surface after onboarding. Reserved for the ~5% edge case
// where no pre-computed bubble fits. Carries a "un-grounded context" warning
// badge downstream; see docs/ARCHITECTURE.md#the-other-fallback.

import { useState } from "react";

type Props = {
  onSubmit: (text: string) => void;
  onCancel: () => void;
};

export function OtherInput({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  return (
    <div className="canvas-ai-other">
      <div className="canvas-ai-other-warn">
        ⚠ Custom input. The AI can't cite your syllabus or rubric for this
        — quality badge will reflect that.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you want here?"
        rows={3}
        className="canvas-ai-other-input"
      />
      <div className="canvas-ai-other-actions">
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
        >
          Use this
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
