// Injection target: /courses/:id
// Fixed floating action button (bottom-right): "🛠 Rebuild unit".

import { useState } from "react";
import { BubbleTree } from "../bubbles/BubbleTree";

export default function CourseHomeInjector() {
  const [open, setOpen] = useState(false);
  const courseId = location.pathname.match(/\/courses\/(\d+)/)?.[1] ?? "";

  return (
    <div className="canvas-ai-course-home-fab">
      <button onClick={() => setOpen((v) => !v)}>🛠 Rebuild unit</button>
      {open && <BubbleTree kind="rebuild_unit" courseId={courseId} />}
    </div>
  );
}
