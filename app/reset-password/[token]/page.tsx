"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetWithTokenPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d?.error ?? "Failed to reset password");
        return;
      }
      setMsg("Password reset successful. You can log in now.");
      setTimeout(() => router.push("/login"), 800);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-black px-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-8">
        {/* Qrest Logo (black) */}
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-5xl font-extrabold tracking-tight text-black drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]">
            Q<span className="text-black">rest</span>
          </h1>
          <p className="mt-2 text-sm text-gray-200">Set a new password</p>
        </div>

        {/* Token (show so user knows which token is being used) */}
        <p className="text-xs text-gray-300 break-all mb-4">
          Token: <code className="font-mono">{String(token ?? "")}</code>
        </p>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            className="w-full rounded-lg px-4 py-2 bg-white/20 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <input
            type="password"
            className="w-full rounded-lg px-4 py-2 bg-white/20 text-white placeholder-gray-300 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {err && <div className="text-sm text-red-400">{err}</div>}
          {msg && <div className="text-sm text-green-400">{msg}</div>}

          <button
            disabled={busy}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:opacity-90 transition disabled:opacity-60"
          >
            {busy ? "Saving…" : "Reset password"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-300">
          Remembered your password?{" "}
          <a href="/login" className="font-medium text-indigo-300 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
