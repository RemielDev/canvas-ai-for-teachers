"use client";

// THE ONLY TYPED SCREEN on the web side. Matches the extension's Options.tsx.
// After the teacher connects here, every subsequent page is tap-only.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConnectPage() {
  const router = useRouter();
  const [canvasUrl, setCanvasUrl] = useState("");
  const [pat, setPat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_url: canvasUrl, pat }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-brand-900">
        Connect to Canvas
      </h1>
      <p className="mt-2 text-slate-600">
        This is the only screen where you'll type anything. After this, every
        action is a tap.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Canvas URL</span>
          <input
            type="url"
            required
            placeholder="https://canvas.instructure.com"
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">
            Personal Access Token
          </span>
          <input
            type="password"
            required
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-brand-500"
          />
          <span className="text-xs text-slate-500">
            Generate one in Canvas → Account → Settings → + New Access Token.
            We KMS-wrap it on our backend and never hold it on your device.
          </span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-md bg-brand-700 px-4 py-2 text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {loading ? "Connecting…" : "Connect"}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>
    </main>
  );
}
