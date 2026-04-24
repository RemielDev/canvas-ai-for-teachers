// Entry point for all content-script injections.
// Detects the current Canvas page type and mounts the matching React root.
// Per-page injectors live in src/content/targets/.

import { createRoot } from "react-dom/client";
import React from "react";

type Target =
  | "assignment-editor"
  | "speedgrader"
  | "gradebook"
  | "course-home"
  | "module-view"
  | null;

function detectTarget(pathname: string): Target {
  if (/\/courses\/\d+\/assignments\/\d+\/edit/.test(pathname))
    return "assignment-editor";
  if (/\/courses\/\d+\/gradebook\/speed_grader/.test(pathname))
    return "speedgrader";
  if (/\/courses\/\d+\/gradebook$/.test(pathname)) return "gradebook";
  if (/\/courses\/\d+\/modules/.test(pathname)) return "module-view";
  if (/\/courses\/\d+\/?$/.test(pathname)) return "course-home";
  return null;
}

async function mount() {
  const target = detectTarget(location.pathname);
  if (!target) return;

  const host = document.createElement("div");
  host.id = `canvas-ai-${target}`;
  document.body.appendChild(host);
  const root = createRoot(host);

  switch (target) {
    case "assignment-editor": {
      const { default: App } = await import("./targets/assignment-editor");
      root.render(React.createElement(App));
      break;
    }
    case "speedgrader": {
      const { default: App } = await import("./targets/speedgrader");
      root.render(React.createElement(App));
      break;
    }
    case "gradebook": {
      const { default: App } = await import("./targets/gradebook");
      root.render(React.createElement(App));
      break;
    }
    case "course-home": {
      const { default: App } = await import("./targets/course-home");
      root.render(React.createElement(App));
      break;
    }
    case "module-view": {
      const { default: App } = await import("./targets/module-view");
      root.render(React.createElement(App));
      break;
    }
  }
}

// Canvas is a SPA in several places — remount on history changes.
let currentPath = location.pathname;
new MutationObserver(() => {
  if (location.pathname !== currentPath) {
    currentPath = location.pathname;
    document
      .querySelectorAll('[id^="canvas-ai-"]')
      .forEach((el) => el.remove());
    void mount();
  }
}).observe(document.body, { subtree: true, childList: true });

void mount();
