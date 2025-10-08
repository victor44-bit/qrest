"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function EnterResetTokenPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  // Try to auto-paste a token if the browser allows
  useEffect(() => {
    (async () => {
      try {
        const t = await navigator.clipboard.readText();
        if (t && /^[a-f0-9]{64}$/i.test(t.trim())) setToken(t.trim());
      } catch {
        // ignore if clipboard read isn't allowed
      }
    })();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const t = token.trim();
    if (!t) {
      setErr("Please paste the token from your email.");
      return;
    }
    router.push(`/reset-password/${encodeURIComponent(t)}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-gray-900 to-black px-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8">
        {/* Qrest Logo (black, placed on a white pill so it pops on dark bg) */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center rounded-full bg-white px-4 py-2 shadow">
            <span className="text-2xl font-extrabold tracking-tight text-black">Q</span>
            <span className="ml-0.5 text-2xl font-extrabold tracking-tight text-black/80">rest</span>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-white text-center">Enter Reset Token</h1>
        <p className="mt-2 text-sm text-gray-300 text-center">
          We emailed you a token. Paste it below to continue.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg px-4 py-2 bg-white/20 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder="paste-your-token-here"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {err && <div className="text-sm text-red-400">{err}</div>}

          <button
            className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:opacity-90 transition"
          >
            Continue
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Tip: If your browser allows it, we try to auto-paste from your clipboard.
        </p>
      </div>
    </div>
  );
}
