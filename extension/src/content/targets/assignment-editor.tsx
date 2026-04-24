// Injection target: /courses/:id/assignments/:aid/edit
// Adds an "✨ AI draft" button next to the native Save and opens a BubbleTree.

import { useState } from "react";
import { BubbleTree } from "../bubbles/BubbleTree";

export default function AssignmentEditorInjector() {
  const [open, setOpen] = useState(false);
  const courseId = location.pathname.match(/\/courses\/(\d+)/)?.[1] ?? "";

  return (
    <div className="canvas-ai-assignment-editor">
      <button
        className="canvas-ai-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        ✨ AI draft
      </button>
      {open && (
        <BubbleTree
          kind="draft_assignment"
          courseId={courseId}
          onTerminal={(preview) => {
            console.log("[canvas-ai] preview ready", preview);
          }}
        />
      )}
    </div>
  );
}
