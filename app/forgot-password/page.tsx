"use client";
import React from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show a generic success
      setMsg("If an account exists for that email, a reset link has been sent.");
    } catch (e: any) {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Enter your email and we’ll send you a reset link.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mt-3 w-full rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-800 dark:text-neutral-100"
      />
      <button
        onClick={submit}
        disabled={busy || !email}
        className="mt-3 rounded-lg bg-neutral-900 dark:bg-white px-4 py-2 text-white dark:text-neutral-900 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
      {msg && <div className="mt-3 text-sm text-green-600 dark:text-green-400">{msg}</div>}
      {err && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</div>}
    </main>
  );
}
