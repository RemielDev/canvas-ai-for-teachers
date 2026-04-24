// THE ONLY TYPED SCREEN. After this, the teacher only taps.
// Collects Canvas URL + PAT, exchanges for JWT via backend /auth/connect.
// PAT is never stored in the extension — the backend KMS-wraps it.

import { useEffect, useState } from "react";
import * as storage from "@/shared/storage";
import { connect, signout } from "@/shared/backend-client";

export function Options() {
  const [canvasUrl, setCanvasUrl] = useState("");
  const [pat, setPat] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void storage.get("jwt").then((j) => setConnected(!!j));
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { jwt, refreshToken, teacherId } = await connect(canvasUrl, pat);
      await storage.set("jwt", jwt);
      await storage.set("refreshToken", refreshToken);
      await storage.set("teacherId", teacherId);
      await storage.set("canvasUrl", canvasUrl);
      await storage.set("lastSignInAt", Date.now());
      setConnected(true);
      setPat(""); // never hold the PAT in component state longer than needed
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignout() {
    await signout();
    setConnected(false);
    setCanvasUrl("");
  }

  if (connected) {
    return (
      <div className="canvas-ai-options-body">
        <h1>Canvas AI</h1>
        <p>You're connected. Close this tab and open any Canvas page.</p>
        <button onClick={handleSignout}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="canvas-ai-options-body">
      <h1>Connect to Canvas</h1>
      <p>
        This is the only screen where you'll type anything. Paste your Canvas
        URL and a Personal Access Token. You can generate a PAT at{" "}
        <em>Canvas → Account → Settings → + New Access Token</em>.
      </p>
      <form onSubmit={handleConnect}>
        <label>
          Canvas URL
          <input
            type="url"
            required
            placeholder="https://canvas.instructure.com"
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
          />
        </label>
        <label>
          Personal Access Token
          <input
            type="password"
            required
            value={pat}
            onChange={(e) => setPat(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Connecting…" : "Connect"}
        </button>
        {error && <p className="canvas-ai-error">{error}</p>}
      </form>
    </div>
  );
}
