// Injection target: /courses/:id/modules
// Inline per-module action: "🔧 AI-organize".

import { useState } from "react";
import { BubbleTree } from "../bubbles/BubbleTree";

export default function ModuleViewInjector() {
  const [open, setOpen] = useState(false);
  const courseId = location.pathname.match(/\/courses\/(\d+)/)?.[1] ?? "";

  return (
    <div className="canvas-ai-module-view">
      <button onClick={() => setOpen((v) => !v)}>🔧 AI-organize</button>
      {open && <BubbleTree kind="custom" courseId={courseId} />}
    </div>
  );
}
