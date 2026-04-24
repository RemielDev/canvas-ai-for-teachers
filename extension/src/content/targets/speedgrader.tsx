// Injection target: /courses/:id/gradebook/speed_grader
// Slide-out drawer: "Rubric-locked bulk feedback".

import { useState } from "react";
import { BubbleTree } from "../bubbles/BubbleTree";

export default function SpeedGraderInjector() {
  const [open, setOpen] = useState(false);
  const courseId = location.pathname.match(/\/courses\/(\d+)/)?.[1] ?? "";

  return (
    <div className={`canvas-ai-speedgrader ${open ? "open" : ""}`}>
      <button className="canvas-ai-drawer-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Close" : "Rubric-locked feedback"}
      </button>
      {open && <BubbleTree kind="bulk_feedback" courseId={courseId} />}
    </div>
  );
}
