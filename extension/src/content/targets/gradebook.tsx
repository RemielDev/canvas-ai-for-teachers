// Injection target: /courses/:id/gradebook
// Floating badge: "⚠ N at-risk students — tap to open radar".

import { useEffect, useState } from "react";
import { BubbleTree } from "../bubbles/BubbleTree";

export default function GradebookInjector() {
  const [open, setOpen] = useState(false);
  const [atRiskCount, setAtRiskCount] = useState<number | null>(null);
  const courseId = location.pathname.match(/\/courses\/(\d+)/)?.[1] ?? "";

  useEffect(() => {
    // TODO: fetch a quick risk count from backend; placeholder for now.
    setAtRiskCount(3);
  }, []);

  if (atRiskCount === null) return null;

  return (
    <div className="canvas-ai-gradebook-badge">
      <button onClick={() => setOpen((v) => !v)}>
        ⚠ {atRiskCount} at-risk — open radar
      </button>
      {open && <BubbleTree kind="risk_radar" courseId={courseId} />}
    </div>
  );
}
