"use client";

import { useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const res = await fetch(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        cache: "no-store",
        credentials: "include", // ← ensure qrest_admin cookie is sent
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed to load users (${res.status})`);
      setUsers(json.users || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load users");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function deleteUser(id: string, email: string) {
    setErr("");
    const ok = window.confirm(`Delete user "${email}"?\nAll their chains & contributions will be removed.`);
    if (!ok) return;

    // optimistic UI
    const prev = users;
    setUsers((u) => u.filter((x) => x.id !== id));

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUsers(prev); // rollback
        throw new Error(json?.error || `Failed to delete (${res.status})`);
      }
      // success: optionally you can show a toast/alert here
    } catch (e: any) {
      setErr(e?.message || "Failed to delete user");
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin • Users</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-64 rounded border px-3 py-2"
          />
          <button className="rounded bg-neutral-900 px-4 py-2 text-white">Search</button>
        </form>
      </div>

      {/* total user count */}
      <div className="mb-3 text-sm text-neutral-700">
        Total users: <b>{users.length}</b>
      </div>

      {err && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Joined</th>
              <th className="p-2">ID</th>
              <th className="p-2">Actions</th>{/* ← NEW */}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name || "—"}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{new Date(u.createdAt).toLocaleString()}</td>
                <td className="p-2 text-[11px] text-neutral-500">{u.id}</td>
                <td className="p-2">
                  <button
                    onClick={() => void deleteUser(u.id, u.email)}
                    className="rounded border px-2 py-1 text-red-600 border-red-300 hover:bg-red-50"
                    title="Delete user and all their content"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-neutral-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch("/api/admin/logout", { method: "POST", credentials: "include" }); // ← include cookie
          window.location.href = "/admin/login";
        }}
      >
        <button className="rounded border px-3 py-2">Log out</button>
      </form>
    </main>
  );
}
