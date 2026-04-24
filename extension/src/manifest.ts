import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "Canvas AI for Teachers",
  version: pkg.version,
  description:
    "AI workflows inside your Canvas course. Draft assignments, rebuild units, surface at-risk students — all with a tap.",
  icons: {
    "16": "icons/16.png",
    "32": "icons/32.png",
    "48": "icons/48.png",
    "128": "icons/128.png",
  },
  action: { default_popup: "src/popup/index.html" },
  options_page: "src/options/index.html",
  permissions: ["storage", "activeTab"],
  host_permissions: [
    "https://*.instructure.com/*",
    "https://api.canvasai.app/*",
  ],
  externally_connectable: {
    matches: ["https://*.canvasai.app/*"],
  },
  content_scripts: [
    {
      matches: ["https://*.instructure.com/*"],
      js: ["src/content/mount.ts"],
      run_at: "document_idle",
    },
  ],
  background: {
    service_worker: "src/background/service_worker.ts",
    type: "module",
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },
});
