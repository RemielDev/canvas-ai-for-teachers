// Toolbar popup. Quick actions + class picker.
// If teacher isn't connected, sends them to the Options page.

import { useEffect, useState } from "react";
import * as storage from "@/shared/storage";

export function Popup() {
  const [jwt, setJwt] = useState<string | null>(null);

  useEffect(() => {
    void storage.get("jwt").then(setJwt);
  }, []);

  if (!jwt) {
    return (
      <div className="canvas-ai-popup-body">
        <p>Not connected to Canvas yet.</p>
        <button onClick={() => chrome.runtime.openOptionsPage()}>
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-ai-popup-body">
      <h2>Canvas AI</h2>
      <p>
        Tip: open any Canvas assignment, gradebook, or course page — the AI
        controls appear inline.
      </p>
      <button
        onClick={() => {
          void chrome.tabs.create({ url: "https://canvasai.app/dashboard" });
        }}
      >
        Open dashboard
      </button>
    </div>
  );
}
