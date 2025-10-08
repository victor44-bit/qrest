"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({} as any));
      if (!r.ok) {
        setErr(data?.error ?? "Failed to send reset email");
        return;
      }
      setMsg("We've sent a reset token to your email.");
      // ⬇️ keep your original behavior: go straight to token entry
      router.push("/userp-reset");
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-indigo-900 via-slate-900 to-black">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            <span className="text-black drop-shadow-[0_0_1px_rgba(255,255,255,0.5)] bg-white/90 px-2 py-1 rounded">Q</span>
            <span className="text-white">rest</span>
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Forgot your password? We’ll send a token to your email.
          </p>
        </div>

        {/* Glass card */}
        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl p-6 space-y-4"
        >
          <label className="block text-sm font-medium text-slate-200">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg px-4 py-2 bg-white/15 text-white placeholder-slate-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {err && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/20 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          {msg && (
            <div className="text-sm text-emerald-300 bg-emerald-900/20 border border-emerald-500/20 rounded-md px-3 py-2">
              {msg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !email}
            className="w-full rounded-lg py-2 font-semibold text-white disabled:opacity-60
                       bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 transition"
          >
            {busy ? "Sending…" : "Send reset email"}
          </button>

          <p className="text-center text-xs text-slate-300">
            After we send the token, we’ll take you to the token page automatically.
          </p>
        </form>
      </div>
    </div>
  );
}
