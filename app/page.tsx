export const dynamic = 'force-dynamic';
"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import MindMap from "@/components/MindMap";
import ThemeToggle from "@/components/ThemeToggle";
/* =========================
   Types & utils
   ========================= */
type WithId = { id?: string; _id?: string };
type Contribution = WithId & {
  text: string;
  authorName?: string | null;
  authorId?: string | null;
  likes: number;
  createdAt: string | number | Date;
  replyCount?: number;
  parentId?: string | null;
  images?: string[];
};
type ChainSummary = WithId & {
  title: string;
  tags: string[];
  likes: number;
  views: number;              // <-- ADD
  contributions: number;
  createdAt: string | number | Date;
  authorName?: string | null;
  authorId?: string | null;
  images?: string[];
};
type Chain = WithId & {
  title: string;
  tags: string[];
  likes: number;
  views: number;              // <-- ADD
  createdAt: string | number | Date;
  contributions: Contribution[];
  authorName?: string | null;
  authorId?: string | null;
  canDelete?: boolean;
  images?: string[];
};
const toValidDate = (d: unknown): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const parsed = new Date(String(d));
  return isNaN(parsed.getTime()) ? null : parsed;
};
const timeAgo = (dIn: unknown) => {
  const d = toValidDate(dIn);
  if (!d) return "just now";
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};
const getAnyId = (o: WithId) => String(o.id ?? o._id ?? "");
// ===== Views helpers =====
const formatCount = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  : n >= 1_000 ? (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  : String(n);
// 30-min client-side de-dup to avoid overcounting
const VIEW_LS_KEY = "qrest_chain_viewed_at";
const VIEW_WINDOW_MIN = 30;
const nowMs = () => Date.now();
const shouldCountView = (id: string) => {
  try {
    const map = JSON.parse(localStorage.getItem(VIEW_LS_KEY) || "{}");
    return nowMs() - (map[id] ?? 0) > VIEW_WINDOW_MIN * 60_000;
  } catch { return true; }
};
const markViewCounted = (id: string) => {
  try {
    const map = JSON.parse(localStorage.getItem(VIEW_LS_KEY) || "{}");
    map[id] = nowMs();
    localStorage.setItem(VIEW_LS_KEY, JSON.stringify(map));
  } catch {}
};
const MAX_LIKES_PER_CONTRIB = 5;
const LS_KEY = "qrest_contrib_likes";
type ContribLikeMap = Record<string, number>;
const readContribLikesGiven = (): ContribLikeMap => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as ContribLikeMap) : {};
  } catch {
    return {};
  }
};
const writeContribLikesGiven = (m: ContribLikeMap) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(m));
  } catch {}
};
/* =========================
   Reply section (logic unchanged)
   ========================= */
function ReplySection({
  chainId,
  rootContribId,
  parentId,
  initialCount = 0,
}: {
  chainId: string;
  rootContribId: string;
  parentId: string;
  initialCount?: number;
}) {
  type R = {
    id?: string;
    _id?: string;
    text: string;
    createdAt: string | number | Date;
    authorName?: string | null;
    replyCount?: number;
  };
  const anyId = (o: { id?: string; _id?: string }) => String(o.id ?? o._id ?? "");
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [listBusy, setListBusy] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [items, setItems] = React.useState<R[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = React.useState(false);
  const [hasPostedOnce, setHasPostedOnce] = React.useState(false);
  const [count, setCount] = React.useState<number>(initialCount);
  const load = async (cursor?: string | null) => {
    setListBusy(true);
    setError("");
    try {
      const url =
        `/api/chains/${chainId}/contributions/${rootContribId}/replies?take=10` +
        (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
      const res = await fetch(url, {
        cache: "no-store",
        headers: { "x-parent-id": parentId },
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Failed to load replies (${res.status})`;
        try {
          const d = await res.json();
          if (d?.error) msg += `: ${d.error}`;
        } catch {}
        throw new Error(msg);
      }
      const data = (await res.json()) as { items: R[]; nextCursor: string | null };
      setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
      setInitialLoaded(true);
      const nextCountCandidate = cursor ? items.length + data.items.length : data.items.length;
      setCount((prev) => Math.max(prev, nextCountCandidate));
    } catch (e: any) {
      setError(e?.message || "Failed to load replies");
    } finally {
      setListBusy(false);
    }
  };
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/chains/${chainId}/contributions/${rootContribId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-parent-id": parentId,
        },
        body: JSON.stringify({ parentId, text: t }),
        credentials: "include",
      });
      if (!res.ok) {
        let msg = "Failed to post reply";
        try {
          const d = await res.json();
          if (d?.error) msg += ` (${d.error})`;
        } catch {}
        throw new Error(msg);
      }
      const reply: R = await res.json();
      setText("");
      setHasPostedOnce(true);
      if (!open) setOpen(true);
      setItems((prev) => [reply, ...prev]);
      setCount((n) => n + 1);
    } catch (e: any) {
      setError(e?.message || "Failed to post reply");
    } finally {
      setBusy(false);
    }
  };
  React.useEffect(() => {
    if ((open || hasPostedOnce) && !initialLoaded && !listBusy) void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasPostedOnce]);
  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!busy && text.trim()) void submit();
    }
  };
  const countLabel = `Replies (${count})`;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-dark-border"
        >
          {open ? "Hide replies" : countLabel}
        </button>
        {listBusy && <span className="text-[11px] text-neutral-500">loading…</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
      {open && (
        <div className="mt-2 rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card p-3">
          <div className="flex items-start gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Write a reply…"
              rows={3}
              className="flex-1 resize-y rounded-xl border dark:border-dark-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-800 dark:bg-dark-card dark:text-neutral-100"
            />
            <button
              onClick={submit}
              disabled={busy || !text.trim()}
              className="rounded-full bg-neutral-900 dark:bg-white px-3 py-2 text-xs text-white dark:text-neutral-900 disabled:opacity-50"
            >
              {busy ? "Posting…" : "Reply"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {items.map((r) => {
              const rid = anyId(r);
              return (
                <div key={rid} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="w-5 shrink-0" />
                    <div className="flex-1 rounded-xl bg-neutral-50 dark:bg-dark-bg px-3 py-2">
                      <div className="whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-100">{r.text}</div>
                      <div className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {r.authorName ?? "Anon"} • {timeAgo(r.createdAt)}{" "}
                        {typeof r.replyCount === "number" ? `• ${r.replyCount} repl${r.replyCount === 1 ? "y" : "ies"}` : null}
                      </div>
                    </div>
                  </div>
                  <div className="ml-8">
                    <ReplySection
                      chainId={chainId}
                      rootContribId={rootContribId}
                      parentId={rid}
                      initialCount={Number(r.replyCount ?? 0)}
                    />
                  </div>
                </div>
              );
            })}
            {listBusy && <div className="py-2 text-center text-xs text-neutral-500">Loading…</div>}
          </div>
          {nextCursor && !listBusy && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => void load(nextCursor)}
                className="rounded-full border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-dark-border dark:text-neutral-100"
              >
                Load more replies
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/* =========================
   Page
   ========================= */
type FeedScope = "all" | "mine";
export default function Page() {
  const [activeTab, setActiveTab] = useState<"feed" | "new" | "leaderboard" | "map">("feed");
  const [feedScope, setFeedScope] = useState<FeedScope>("all");
  const [feed, setFeed] = useState<ChainSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Chain | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [error, setError] = useState<string>("");
  const [detailView, setDetailView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [contribLikesGiven, setContribLikesGiven] = useState<ContribLikeMap>({});
  const [busy, setBusy] = useState(false);
  // NEW: search panel toggle
  const [showSearch, setShowSearch] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = (await r.json()) as { user: { id: string } | null };
        if (mounted) setCurrentUserId(d.user?.id ?? null);
      } catch {
        if (mounted) setCurrentUserId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const feedReqIdRef = useRef(0);
  const oneReqIdRef = useRef(0);
  useEffect(() => setContribLikesGiven(readContribLikesGiven()), []);
  useEffect(() => writeContribLikesGiven(contribLikesGiven), [contribLikesGiven]);
async function loadFeed(scope: FeedScope = feedScope) {
  const myId = ++feedReqIdRef.current;
  try {
    setLoadingFeed(true);
    setError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    // build URL without a trailing '?'
    const qs = params.toString();
    const url =
      scope === "mine"
        ? `/api/chains/mine${qs ? `?${qs}` : ""}`
        : `/api/chains${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "include", // ← ensure qrest_user cookie is sent
    });
    if (res.status === 401 && scope === "mine") {
      // nice UX: show a clear message instead of a generic error
      setError("Please log in to view your chains.");
      setFeed([]);
      return;
    }
    if (!res.ok) throw new Error(`Feed failed (${res.status})`);
    const raw = await res.json();
    const data: ChainSummary[] = (Array.isArray(raw) ? raw : raw?.data ?? []).map((x: any) => ({
      ...x,
      views: Number(x?.views ?? 0),
    }));
    if (myId !== feedReqIdRef.current) return;
    setFeed(data);
  } catch (e: any) {
    if (myId !== feedReqIdRef.current) return;
    setError(e?.message || "Failed to load feed");
  } finally {
    if (myId === feedReqIdRef.current) setLoadingFeed(false);
  }
}
  async function loadOne(id: string) {
    const myId = ++oneReqIdRef.current;
    try {
      setError("");
      const res = await fetch(`/api/chains/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Detail failed (${res.status})`);
      const raw: any = await res.json();
      const data: Chain = {
        ...raw,
        id: getAnyId(raw),
        views: Number(raw?.views ?? 0),            // <-- ADD
        images: Array.isArray(raw.images) ? raw.images : [],
        contributions: (Array.isArray(raw.contributions) ? raw.contributions : [])
          .map((c: any) => ({
            ...c,
            id: getAnyId(c),
            parentId: c.parentId ?? null,
            images: Array.isArray(c.images) ? c.images : [],
          }))
          .filter((c: any) => c.parentId == null),
      };
      if (myId !== oneReqIdRef.current) return;
      setSelected(data);
    } catch (e: any) {
      if (myId !== oneReqIdRef.current) return;
      setError(e?.message || "Failed to load chain");
    }
  }
  useEffect(() => {
    void loadFeed("all");
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void loadFeed(feedScope), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedScope, query]);
 useEffect(() => {
  if (!selectedId) return;
  ++oneReqIdRef.current;
  (async () => {
    await loadOne(selectedId);        // load chain first
    await bumpChainView(selectedId);  // then bump view count
  })();
}, [selectedId]);
  const tags = useMemo(() => {
    const t = new Set<string>();
    feed.forEach((c) => c.tags.forEach((x) => t.add(x)));
    return ["all", ...Array.from(t)];
  }, [feed]);
  const filteredFeed = feed.filter((c) => {
    const matchesQuery = !query || c.title.toLowerCase().includes(query.toLowerCase());
    const matchesTag = tagFilter === "all" || c.tags.includes(tagFilter);
    return matchesQuery && matchesTag;
  });
  async function createChain(p: { title: string; tags: string[]; images?: string[] }) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        let msg = "Failed to create chain";
        try {
          const d: { error?: string } = await res.json();
          if (d?.error) msg = d.error;
        } catch {}
        throw new Error(msg);
      }
      await loadFeed(feedScope);
    } finally {
      setBusy(false);
    }
  }
  async function likeChain(id: string) {
    setError("");
    setSelected((prev) => (prev && getAnyId(prev) === id ? { ...prev, likes: prev.likes + 1 } : prev));
    setFeed((prev) => prev.map((c) => (getAnyId(c) === id ? { ...c, likes: c.likes + 1 } : c)));
    const res = await fetch(`/api/chains/${id}`, { method: "POST" });
    if (!res.ok) {
      setSelected((prev) => (prev && getAnyId(prev) === id ? { ...prev, likes: prev.likes - 1 } : prev));
      setFeed((prev) => prev.map((c) => (getAnyId(c) === id ? { ...c, likes: c.likes - 1 } : c)));
      try {
        const d: { error?: string } = await res.json();
        setError(d?.error ?? "Failed to like chain");
      } catch {
        setError("Failed to like chain");
      }
    }
  }
  async function addContribution(id: string, payload: { text: string; images?: string[] }) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/chains/${id}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload.text, images: payload.images ?? [] }),
      });
      if (!res.ok) {
        try {
          const d: { error?: string } = await res.json();
          throw new Error(d?.error ?? "Failed to add contribution");
        } catch {
          throw new Error("Failed to add contribution");
        }
      }
      await loadOne(id);
      await loadFeed(feedScope);
    } finally {
      setBusy(false);
    }
  }
  async function likeContribution(chainId: string, contribId: string) {
    setError("");
    const alreadyGiven = (readContribLikesGiven()[contribId] ?? 0) as number;
    if (alreadyGiven >= 1) {
    }
    setSelected((prev) => {
      if (!prev || getAnyId(prev) !== chainId) return prev;
      return {
        ...prev,
        contributions: prev.contributions.map((c) => (getAnyId(c) === contribId ? { ...c, likes: c.likes + 1 } : c)),
      };
    });
    setContribLikesGiven((m) => ({ ...m, [contribId]: alreadyGiven + 1 }));
    const res = await fetch(`/api/chains/${chainId}/contributions/${contribId}/like`, { method: "POST" });
    if (!res.ok) {
      setSelected((prev) => {
        if (!prev || getAnyId(prev) !== chainId) return prev;
        return {
          ...prev,
          contributions: prev.contributions.map((c) =>
            getAnyId(c) === contribId ? { ...c, likes: Math.max(0, c.likes - 1) } : c,
          ),
        };
      });
      setContribLikesGiven((m) => ({ ...m, [contribId]: alreadyGiven }));
      try {
        const d: { error?: string } = await res.json();
        setError(d?.error ?? "Failed to like contribution");
      } catch {
        setError("Failed to like contribution");
      }
    }
  }
  async function bumpChainView(id: string) {
  try {
    if (!shouldCountView(id)) return;
    // Optimistic: show +1 quickly
    setSelected((prev) => (prev && getAnyId(prev) === id ? { ...prev, views: (prev.views ?? 0) + 1 } : prev));
    setFeed((prev) =>
      prev.map((c) => (getAnyId(c) === id ? { ...c, views: ((c as any).views ?? 0) + 1 } : c))
    );
    const res = await fetch(`/api/chains/${id}/views`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const serverViews = Number(data?.views ?? 0);
      if (serverViews > 0) {
        // Reconcile to authoritative count
        setSelected((prev) =>
          prev && getAnyId(prev) === id
            ? { ...prev, views: Math.max(prev.views ?? 0, serverViews) }
            : prev
        );
        setFeed((prev) =>
          prev.map((c) =>
            getAnyId(c) === id ? { ...c, views: Math.max((c as any).views ?? 0, serverViews) } : c
          )
        );
      }
    }
  } catch {
    // ignore
  } finally {
    markViewCounted(id);
  }
}
async function deleteContribution(chainId: string, contribId: string) {
  setError("");
  // Optimistic UI: remove locally first
  setSelected((prev) => {
    if (!prev || getAnyId(prev) !== chainId) return prev;
    return {
      ...prev,
      contributions: prev.contributions.filter((c) => getAnyId(c) !== contribId),
    };
  });
  try {
    const res = await fetch(
      `/api/chains/${chainId}/contributions/${contribId}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );
    if (!res.ok) {
      // Roll back UI on failure
      await loadOne(chainId);
      try {
        const d: { error?: string } = await res.json();
        setError(d?.error ?? "Failed to delete contribution");
      } catch {
        setError("Failed to delete contribution");
      }
      return;
    }
    // Refresh details & feed to stay in sync
    await loadOne(chainId);
    await loadFeed(feedScope);
  } catch (e: any) {
    await loadOne(chainId);
    setError(e?.message || "Failed to delete contribution");
  }
}
async function deleteChain(chainId: string) {
  setError("");
  const ok = window.confirm("Delete this chain (and all its contributions)? This cannot be undone.");
  if (!ok) return;
  // Optimistic remove from feed
  setFeed((prev) => prev.filter((c) => getAnyId(c) !== chainId));
  if (selectedId === chainId) {
    setSelectedId(null);
    setSelected(null);
    setDetailView("list");
  }
  const res = await fetch(`/api/chains/${chainId}`, { method: "DELETE" });
  if (!res.ok) {
    // Rollback by reloading
    await loadFeed(feedScope);
    if (selectedId === chainId) await loadOne(chainId);
    try {
      const d: { error?: string } = await res.json();
      setError(d?.error ?? "Failed to delete chain");
    } catch {
      setError("Failed to delete chain");
    }
  }
}
  const goHome = () => {
    // Reset all UI states to default
    setShowSearch(false);
    setFeedScope("all");
    setQuery("");
    setTagFilter("all");
    setActiveTab("feed");
    setDetailView("list");
    setSelectedId(null);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /* =========================
     UI (dark mode via Tailwind 'class'; ThemeToggle uses next-themes)
     ========================= */
  return (
    <div className="min-h-screen bg-white dark:bg-dark-bg text-neutral-900 dark:text-neutral-100">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogoClick={goHome}
        onToggleSearch={() => setShowSearch((v) => !v)}
      />
      {/* Search & filters tray (hidden until toggled) */}
      {showSearch && (
        <div className="sticky top-[56px] z-10 border-b dark:border-dark-border bg-white/95 dark:bg-dark-bg/90 px-2 py-1.5 backdrop-blur md:top-[64px] md:px-3">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chains…"
                className="w-full rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1.5 outline-none focus:ring-2 focus:ring-neutral-800 dark:text-neutral-100 md:w-72"
              />
              <div className="flex items-center gap-2 md:ml-2">
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1.5 dark:text-neutral-100 md:w-auto"
                >
                  {tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card p-1">
                  <button
                    onClick={() => setFeedScope("all")}
                    className={`rounded-md px-3 py-1 text-sm ${
                      feedScope === "all"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-dark-border"
                    }`}
                    title="Show community feed"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFeedScope("mine")}
                    className={`rounded-md px-3 py-1 text-sm ${
                      feedScope === "mine"
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-dark-border"
                    }`}
                    title="Show only my chains"
                  >
                    My Chains
                  </button>
                </div>
              </div>
            </div>
            <div className="flex w-full gap-2 md:w-auto md:justify-end">
              <button
                onClick={() => {
                  setActiveTab("new");
                  setDetailView("list");
                }}
                className="flex-1 rounded-lg bg-neutral-900 dark:bg-white px-4 py-1.5 text-white dark:text-neutral-900 shadow hover:shadow-md active:scale-[0.99] md:flex-none"
                disabled={busy}
              >
                + Start a Chain
              </button>
              <button
                onClick={() => {
                  if (selectedId && selected) {
                    setActiveTab("map");
                    setDetailView("map");
                    return;
                  }
                  const first = filteredFeed.length > 0 ? filteredFeed[0] : null;
                  if (first) {
                    const firstId = String((first as any).id ?? (first as any)._id ?? "");
                    setSelectedId(firstId);
                    setDetailView("map");
                    setActiveTab("map");
                  } else {
                    alert("No chains yet. Start a chain to view the mind map!");
                  }
                }}
                className={`rounded-lg border px-4 py-1.5 ${
                  activeTab === "map"
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-dark-border bg-white dark:bg-dark-card text-neutral-700 dark:text-neutral-100"
                }`}
                title="Open mind map"
              >
                Mind Map
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="mx-auto max-w-7xl px-2 md:px-3">
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 p-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        </div>
      )}
      {/* Bottom padding so content is not hidden by bottom nav (and safe-area) */}
      <main
        className="mx-auto max-w-7xl px-2 py-3 md:px-3 md:py-4"
        style={{ paddingBottom: "max(6rem, env(safe-area-inset-bottom))" }}
      >
        {activeTab === "feed" && !selectedId && (
          <FeedView
            scope={feedScope}
            chains={filteredFeed}
            loading={loadingFeed}
            onOpen={(id) => {
              setSelectedId(id);
              setDetailView("list");
            }}
            onLike={(id) => void likeChain(id)}
          />
        )}
        {activeTab === "feed" && selectedId && selected && (
          <ChainDetail
            chain={selected}
            currentUserId={currentUserId}
            detailView={detailView}
            onChangeView={setDetailView}
            onBack={() => {
              setSelectedId(null);
              setSelected(null);
              setDetailView("list");
            }}
            onLikeChain={() => void likeChain(getAnyId(selected))}
            onAddContribution={async (payload: { text: string; images?: string[] }) => {
              if (!selectedId) return;
              await addContribution(selectedId, payload);
            }}
            contribLikesGiven={contribLikesGiven}
            onLikeContribution={(contribId: string) => likeContribution(getAnyId(selected), contribId)}
            onDeleteContribution={(contribId: string) => {
              const chainId = getAnyId(selected);
              if (!chainId) return;
              const ok = window.confirm("Delete this contribution? This cannot be undone.");
              if (!ok) return;
              void deleteContribution(chainId, contribId);
            }}
            onDeleteChain={() => {
              const chainId = getAnyId(selected);
              if (!chainId) return;
              void deleteChain(chainId);
            }}
          />
        )}
        {activeTab === "map" && (
          <MapOnly
            selected={selected}
            selectedId={selectedId}
            filteredFeed={filteredFeed}
            onNeedOpenFirst={(id) => {
              setSelectedId(id);
              setDetailView("map");
            }}
          />
        )}
        {activeTab === "new" && (
          <NewChain
            onCancel={() => setActiveTab("feed")}
            onCreate={async ({ title, tags, images }: { title: string; tags: string[]; images?: string[] }) => {
              await createChain({ title, tags, images });
              setActiveTab("feed");
              await loadFeed(feedScope);
              const list =
                feedScope === "mine"
                  ? ((await (await fetch("/api/chains/mine")).json()).data as ChainSummary[])
                  : await (await fetch("/api/chains")).json();
              const newest = Array.isArray(list) ? list.at(0) : (list as any)?.[0] ?? null;
              if (newest) {
                setSelectedId(getAnyId(newest));
                setDetailView("list");
              }
            }}
          />
        )}
        {activeTab === "leaderboard" && <Leaderboard chainsForBoard={feed} />}
      </main>
      {/* Desktop footer only; mobile uses bottom nav */}
      <footer className="mx-auto hidden max-w-7xl px-3 pb-8 text-sm text-neutral-500 dark:text-neutral-400 md:block">
        <div className="flex items-center justify-between border-t dark:border-dark-border pt-4">
          <span>© {new Date().getFullYear()} Qrest</span>
          <div className="flex items-center gap-3">
            <button
              className="cursor-not-allowed rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 text-neutral-500 dark:text-neutral-400"
              title="Export (coming soon)"
            >
              Export
            </button>
            <button
              className="cursor-not-allowed rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 text-neutral-500 dark:text-neutral-400"
              title="Tags management (coming soon)"
            >
              Manage Tags
            </button>
          </div>
        </div>
      </footer>
      {/* Sticky bottom nav (safe-area aware) */}
      <BottomNav
        activeTab={activeTab}
        onHome={goHome}
        onFeed={() => setActiveTab("feed")}
        onNew={() => setActiveTab("new")}
        onMap={() => setActiveTab("map")}
        onBoard={() => setActiveTab("leaderboard")}
      />
    </div>
  );
}
/* =========================
   Header (mobile-first) — uses ThemeToggle from your setup
   ========================= */
function Header({
  activeTab,
  setActiveTab,
  onLogoClick,
  onToggleSearch,
}: {
  activeTab: "feed" | "new" | "leaderboard" | "map";
  setActiveTab: (t: "feed" | "new" | "leaderboard" | "map") => void;
  onLogoClick: () => void;
  onToggleSearch: () => void;
}) {
  const [me, setMe] = React.useState<{ id: string; email: string; name: string } | null>(null);
  const [loadingMe, setLoadingMe] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingMe(true);
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = (await r.json()) as { user: { id: string; email: string; name: string } | null };
        if (mounted) setMe(d.user);
      } catch {
        if (mounted) setMe(null);
      } finally {
        if (mounted) setLoadingMe(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  }
  const Tab = ({ id, label }: { id: "feed" | "leaderboard"; label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setOpen(false);
      }}
      className={`rounded-lg px-3 py-1 text-sm transition ${
        activeTab === id
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          : "border dark:border-dark-border bg-white dark:bg-dark-card text-neutral-700 dark:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );
  return (
    <header className="sticky top-0 z-20 border-b dark:border-dark-border bg-white/90 dark:bg-dark-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-2 py-1.5 md:px-3 md:py-2">
        <button onClick={onLogoClick} className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 dark:bg-white font-bold text-white dark:text-neutral-900">
            Q
          </div>
          <span className="font-semibold">Qrest</span>
        </button>
        {/* Desktop nav */}
        <div className="hidden items-center gap-3 md:flex">
          <nav className="mr-1 flex gap-2">
            <Tab id="feed" label="Feed" />
            <Tab id="leaderboard" label="Leaderboard" />
          </nav>
          {/* Search toggle */}
          <button
            onClick={onToggleSearch}
            className="grid h-8 w-8 place-items-center rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card text-lg dark:text-neutral-100"
            title="Search & Filters"
            aria-label="Search"
          >
            🔎
          </button>
          {/* Theme toggle (from your ThemeToggle.tsx) */}
          <ThemeToggle />
          {loadingMe ? (
            <span className="text-sm text-neutral-500">…</span>
          ) : !me ? (
            <div className="flex items-center gap-2">
              <a
                href="/login"
                className="rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 dark:text-neutral-100"
              >
                Log in
              </a>
              <a
                href="/signup"
                className="rounded-lg bg-neutral-900 dark:bg-white px-3 py-1 text-white dark:text-neutral-900"
              >
                Sign up
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-neutral-700 dark:text-neutral-300 md:inline">Hi, {me.name}</span>
              <button
                onClick={logout}
                className="rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 dark:text-neutral-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
        {/* Mobile right-side controls */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={onToggleSearch}
            className="grid h-8 w-8 place-items-center rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card text-lg dark:text-neutral-100"
            aria-label="Search"
            title="Search & Filters"
          >
            🔎
          </button>
          {/* Theme toggle for mobile */}
          <ThemeToggle />
          <button
            className="grid h-8 w-8 place-items-center rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card dark:text-neutral-100"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>
      {/* Mobile sheet */}
      {open && (
        <div className="mx-auto block max-w-7xl border-t dark:border-dark-border bg-white dark:bg-dark-card px-2 py-1.5 md:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Tab id="feed" label="Feed" />
            <Tab id="leaderboard" label="Leaderboard" />
            <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-dark-border" />
            {loadingMe ? (
              <span className="text-sm text-neutral-500">…</span>
            ) : !me ? (
              <>
                <a
                  href="/login"
                  className="rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 dark:text-neutral-100"
                >
                  Log in
                </a>
                <a
                  href="/signup"
                  className="rounded-lg bg-neutral-900 dark:bg-white px-3 py-1 text-white dark:text-neutral-900"
                >
                  Sign up
                </a>
              </>
            ) : (
              <>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Hi, {me.name}</span>
                <button
                  onClick={logout}
                  className="rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1 dark:text-neutral-100"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
/* =========================
   Bottom nav (mobile)
   ========================= */
function BottomNav({
  activeTab,
  onHome,
  onFeed,
  onNew,
  onMap,
  onBoard,
}: {
  activeTab: "feed" | "new" | "leaderboard" | "map";
  onHome: () => void;
  onFeed: () => void;
  onNew: () => void;
  onMap: () => void;
  onBoard: () => void;
}) {
  const Item = ({
    label,
    active,
    onClick,
    icon,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
    icon: string;
  }) => (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-xs ${
        active
          ? "bg-neutral-900/90 text-white dark:bg-white/95 dark:text-neutral-900"
          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-dark-border"
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="leading-none">{label}</span>
    </button>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t dark:border-dark-border bg-white/95 dark:bg-dark-bg/95 px-2 py-1 backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-5 gap-1">
        <Item label="Home" active={false} onClick={onHome} icon="🏠" />
        <Item label="Feed" active={activeTab === "feed"} onClick={onFeed} icon="📰" />
        <Item label="New" active={activeTab === "new"} onClick={onNew} icon="➕" />
        <Item label="Map" active={activeTab === "map"} onClick={onMap} icon="🗺️" />
        <Item label="Board" active={activeTab === "leaderboard"} onClick={onBoard} icon="🏆" />
      </div>
    </nav>
  );
}
/* =========================
   Feed (with profile avatar, author name, and stats near like)
   ========================= */
function FeedView({
  scope,
  chains,
  loading,
  onOpen,
  onLike,
}: {
  scope: FeedScope;
  chains: ChainSummary[];
  loading: boolean;
  onOpen: (id: string) => void;
  onLike: (id: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  if (loading)
    return (
      <div className="px-2 py-8 text-center text-neutral-500 dark:text-neutral-300">
        Loading {scope === "mine" ? "my chains" : "feed"}…
      </div>
    );
  if (!chains.length)
    return (
      <div className="px-2 py-8 text-center text-neutral-500 dark:text-neutral-300">
        <div className="text-lg font-medium">
          {scope === "mine" ? "You haven't started any chains yet" : "No chains yet"}
        </div>
        <div className="text-sm mt-1">
          {scope === "mine"
            ? "Kick off your first idea—only you will see it here."
            : "Start your first chain to kick off the brainstorm."}
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      {chains.map((c) => {
        const id = getAnyId(c);
        const cover = Array.isArray(c.images) && c.images.length > 0 ? c.images[0] : null;
        const isExpanded = expandedIds.has(id);
        return (
          <article key={id} className="pb-4 border-b dark:border-dark-border relative">
            {/* Red line from profile to bottom */}
            <div 
              className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-red-500 z-0 pointer-events-none"
              style={{ 
                clipPath: cover 
                  ? 'polygon(0 0, 100% 0, 100% calc(100% - 60px), 0 calc(100% - 60px))' 
                  : 'none'
              }}
            />
            <div className="px-2 flex items-start gap-3 relative z-10">
              {/* Profile avatar */}
              <div className="flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-neutral-600 dark:bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-900 dark:text-neutral-500">
                  {c.authorName?.charAt(0).toUpperCase() || "A"}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {c.authorName || (c.authorId ? "User" : "Anonymous")}
                  </span>
                  <span className="text-[13px] text-neutral-500 dark:text-neutral-400">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <div className="mt-1">
                  <h3
                    className={`text-base font-semibold leading-snug break-words ${
                      !isExpanded ? "line-clamp-4" : ""
                    }`}
                  >
                    {c.title}
                  </h3>
                  {c.title.split(/\r?\n/).join("\n").length > 200 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(id);
                      }}
                      className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      {isExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                  {c.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-neutral-600 dark:text-neutral-300">
                      #{t}
                    </span>
                  ))}
                  {c.tags.length > 3 && <span>+{c.tags.length - 3}</span>}
                </div>
              </div>
            </div>
            {cover && (
              <div className="w-full mt-2 px-2 relative z-20">
                <img
                  src={cover}
                  alt=""
                  className="w-full max-h-64 object-cover rounded-lg"
                />
              </div>
            )}
            <div className="mt-2 px-2 flex justify-between items-center text-[12px] text-neutral-500 dark:text-neutral-400 relative z-10">
              <div>
                {c.contributions} contribs • {formatCount((c as any).views ?? 0)} views
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onLike(id)}
                  className="text-sm font-medium hover:underline dark:text-neutral-100"
                  aria-label="like"
                >
                  ▲ {c.likes}
                </button>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Touch me (please)
                </span>
              </div>
            </div>
            <div className="mt-2 px-2 flex items-center gap-2 relative z-10">
              <button
                onClick={() => onOpen(id)}
                className="rounded-lg bg-white text-neutral-900 border border-neutral-300 px-3 py-1.5 text-sm dark:bg-white dark:text-neutral-900"
              >
                Open
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/?chain=${id}`;
                  const title = c.title || "Check out this chain";
                  if (navigator.share) {
                    navigator.share({ title, url }).catch(() => {});
                    return;
                  }
                  // Fallback: copy to clipboard
                  const textArea = document.createElement("textarea");
                  textArea.value = url;
                  textArea.style.position = "fixed";
                  textArea.style.opacity = "0";
                  document.body.appendChild(textArea);
                  textArea.select();
                  let success = false;
                  try {
                    success = document.execCommand("copy");
                  } catch (err) {
                    // ignore
                  }
                  document.body.removeChild(textArea);
                  const btn = e.currentTarget as HTMLButtonElement;
                  const original = btn.innerHTML;
                  btn.innerHTML = success ? "✓ Copied" : "✗";
                  setTimeout(() => {
                    if (btn.isConnected) btn.innerHTML = "↗";
                  }, 1500);
                }}
                className="text-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                title="Share this chain"
                aria-label="Share"
              >
                ↗
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
/* =========================
   Chain Detail (no "Back to feed", better image fit)
   ========================= */
function ChainDetail({
  chain,
  currentUserId,
  detailView,
  onChangeView,
  onBack,
  onLikeChain,
  onAddContribution,
  contribLikesGiven,
  onLikeContribution,
  onDeleteContribution,
  onDeleteChain,
}: {
  chain: Chain;
  currentUserId: string | null;
  detailView: "list" | "map";
  onChangeView: (v: "list" | "map") => void;
  onBack: () => void;
  onLikeChain: () => void;
  onAddContribution: (payload: { text: string; images?: string[] }) => Promise<void>;
  contribLikesGiven: ContribLikeMap;
  onLikeContribution: (contribId: string) => void;
  onDeleteContribution: (contribId: string) => void;
  onDeleteChain: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
      const urls: string[] = Array.isArray(json?.urls)
        ? json.urls
        : Array.isArray(json?.files)
        ? json.files.map((f: any) => f?.url).filter(Boolean)
        : [];
      if (!urls.length) throw new Error(json?.error || "Upload failed");
      setImages((prev) => Array.from(new Set([...(prev || []), ...urls])).slice(0, 6));
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  function removeImage(u: string) {
    setImages((prev) => (prev || []).filter((x) => x !== u));
  }
  const canDeleteSticky = !!chain.canDelete;
  const validateContribution = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return "Please write something.";
    const paragraphs = trimmed.split(/\r?\n/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 5) return "Up to five paragraphs are allowed.";
    if (trimmed.length > 4000) return "Please keep contributions under 4000 characters.";
    return "";
  };
  const submit = async () => {
    const v = validateContribution(text);
    if (v) {
      setError(v);
      return;
    }
    try {
      await onAddContribution({ text: text.trim(), images });
      setText("");
      setImages([]);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to contribute");
    }
  };
  return (
    <div className="pb-6">
      <div className="px-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {/* Removed "Back to feed" button */}
        <div className="flex items-center gap-2">
          {canDeleteSticky && (
            <button
              onClick={onDeleteChain}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
              title="Delete chain"
            >
              🗑 Delete Chain
            </button>
          )}
          <button
            onClick={() => onChangeView("list")}
            className={`text-sm px-2 py-1 ${
              detailView === "list"
                ? "text-neutral-900 dark:text-white font-medium"
                : "text-neutral-500 dark:text-neutral-300"
            }`}
          >
            List
          </button>
          <button
            onClick={() => onChangeView("map")}
            className={`text-sm px-2 py-1 ${
              detailView === "map"
                ? "text-neutral-900 dark:text-white font-medium"
                : "text-neutral-500 dark:text-neutral-300"
            }`}
          >
            Mind Map
          </button>
          <button
            onClick={onLikeChain}
            className="text-sm font-medium hover:underline dark:text-neutral-100"
          >
            ▲ {chain.likes}
          </button>
        </div>
      </div>
      <div className="px-2 mt-2">
        <h1 className="whitespace-pre-wrap break-words text-xl font-semibold leading-tight">{chain.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          {chain.tags.map((t) => (
            <span key={t} className="text-neutral-600 dark:text-neutral-300">
              #{t}
            </span>
          ))}
          {chain.authorName && <span>• by {chain.authorName}</span>}
          <span>•</span>
          <span>{formatCount(chain.views)} views</span>
        </div>
        {Array.isArray(chain.images) && chain.images.length > 0 && (
          <div className="mt-2">
            {chain.images.slice(0, 6).map((u, i) => (
              <a key={u + i} href={u} target="_blank" rel="noreferrer" className="block mb-2">
                <img
                  src={u}
                  alt=""
                  className="w-full max-h-96 object-contain rounded-lg border dark:border-dark-border"
                />
              </a>
            ))}
          </div>
        )}
      </div>
      <section className="mt-3 px-2">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Add your contribution</h2>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (!text.trim()) return;
                const v = validateContribution(text);
                if (!v) void submit();
                else setError(v);
              }
            }}
            placeholder={"Share up to five short paragraphs."}
            rows={4}
            className="flex-1 resize-y rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-800 dark:text-neutral-100"
          />
          <div className="flex items-center justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-dark-border dark:text-neutral-100">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                multiple
                onChange={onPickFiles}
                className="hidden"
              />
              {uploading ? "Uploading…" : "Add images"}
            </label>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Up to 6 images (optional)</div>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {images.map((u) => (
                <div key={u} className="group relative">
                  <img src={u} alt="" className="h-28 w-full object-cover border dark:border-dark-border rounded" />
                  <button
                    type="button"
                    onClick={() => removeImage(u)}
                    className="absolute right-1 top-1 hidden rounded-md bg-white/90 dark:bg-dark-card/90 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-100 shadow group-hover:block"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button className="rounded-lg bg-neutral-900 dark:bg-white px-4 py-1.5 text-white dark:text-neutral-900" onClick={submit}>
              Contribute
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>
      {detailView === "list" ? (
        <section className="mt-4 px-2">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Contributions</h2>
          <ul className="mt-2 space-y-4">
            {(chain.contributions || [])
              .filter((k) => !(k as any).parentId)
              .map((k) => {
                const cid = getAnyId(k);
                const given = (readContribLikesGiven()[cid] ?? 0) as number;
                const remaining = Math.max(0, MAX_LIKES_PER_CONTRIB - given);
                const disabled = remaining === 0;
                const canDeleteThisContrib = !!(k.authorId && currentUserId && k.authorId === currentUserId);
                return (
                  <li key={cid} className="pt-3 border-t dark:border-dark-border">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-100">{k.text}</p>
                      {Array.isArray(k.images) && k.images.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                          {k.images.map((u, i) => (
                            <a key={u + i} href={u} target="_blank" rel="noreferrer" className="block">
                              <img src={u} alt="" className="h-28 w-full object-cover border dark:border-dark-border rounded" />
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {k.authorName ?? "Anon"} • {timeAgo(k.createdAt)}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => !disabled && onLikeContribution(cid)}
                        disabled={disabled}
                        title={
                          disabled
                            ? `Like limit reached (${MAX_LIKES_PER_CONTRIB}/${MAX_LIKES_PER_CONTRIB})`
                            : `You can like ${remaining} more time${remaining === 1 ? "" : "s"}`
                        }
                        className={`text-sm font-medium ${
                          disabled
                            ? "text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                            : "text-neutral-700 dark:text-neutral-100 hover:underline"
                        }`}
                      >
                        ▲ {k.likes}
                      </button>
                      {canDeleteThisContrib && (
                        <button
                          onClick={() => onDeleteContribution(cid)}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                          title="Delete contribution"
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                    <ReplySection chainId={getAnyId(chain)} rootContribId={cid} parentId={cid} initialCount={k.replyCount ?? 0} />
                  </li>
                );
              })}
          </ul>
        </section>
      ) : (
        <section className="mt-4 px-2">
          <MindMap chain={chain} />
        </section>
      )}
    </div>
  );
}
/* =========================
   MapOnly & NewChain (same logic)
   ========================= */
function MapOnly({
  selected,
  selectedId,
  filteredFeed,
  onNeedOpenFirst,
}: {
  selected: Chain | null;
  selectedId: string | null;
  filteredFeed: ChainSummary[];
  onNeedOpenFirst: (id: string) => void;
}) {
  useEffect(() => {
    if (!selectedId && filteredFeed.length > 0) {
      const first = filteredFeed[0] as ChainSummary;
      const firstId = String((first as any).id ?? (first as any)._id ?? "");
      onNeedOpenFirst(firstId);
    }
  }, [selectedId, filteredFeed, onNeedOpenFirst]);
  if (!filteredFeed.length && !selected) {
    return (
      <div className="px-2 py-8 text-center text-neutral-500 dark:text-neutral-300">
        <div className="text-lg font-medium">No chains yet</div>
        <div className="text-sm mt-1">Start a new chain to generate a mind map.</div>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="px-2 py-8 text-center text-neutral-500 dark:text-neutral-300">
        Loading mind map…
      </div>
    );
  }
  return (
    <section className="px-2">
      <MindMap chain={selected} />
    </section>
  );
}
function NewChain({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (p: { title: string; tags: string[]; images?: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [tagText, setTagText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  async function onPickChainFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      let json: any = null;
      try {
        json = await res.json();
      } catch {}
      if (!res.ok) throw new Error(json?.error || `Upload failed (${res.status})`);
      const urls: string[] = Array.isArray(json?.urls)
        ? json.urls
        : Array.isArray(json?.files)
        ? json.files.map((f: any) => f?.url).filter(Boolean)
        : [];
      if (!urls.length) throw new Error(json?.error || "Upload failed");
      setImages((prev) => Array.from(new Set([...(prev || []), ...urls])).slice(0, 6));
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  function removeChainImage(u: string) {
    setImages((prev) => (prev || []).filter((x) => x !== u));
  }
  const create = async () => {
    setError("");
    if (!title.trim()) {
      setError("Add a short seed idea (you can use new lines).");
      return;
    }
    const tags = Array.from(new Set(tagText.split(",").map((t) => t.trim()).filter(Boolean)));
    try {
      setBusy(true);
      await onCreate({ title: title.trim(), tags, images });
    } catch (e: any) {
      setError(e?.message || "Failed to create");
      return;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl p-4">
      <h2 className="text-xl font-semibold">Start a new Chain</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Multi-paragraph seed ideas are supported.</p>
      <label className="mt-3 block text-sm font-medium">Seed idea</label>
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!busy && title.trim()) void create();
          }
        }}
        placeholder={"What if shoes could charge your phone while you walk?"}
        rows={4}
        className="mt-1 w-full resize-y rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-800 dark:text-neutral-100"
      />
      <label className="mt-3 block text-sm font-medium">Tags (comma-separated)</label>
      <input
        value={tagText}
        onChange={(e) => setTagText(e.target.value)}
        placeholder="tech, sustainability, education"
        className="mt-1 w-full rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-800 dark:text-neutral-100"
      />
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cover images (optional)</span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-dark-border dark:text-neutral-100">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              multiple
              onChange={onPickChainFiles}
              className="hidden"
            />
            {uploading ? "Uploading…" : "Add images"}
          </label>
        </div>
        {images.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {images.map((u) => (
              <div key={u} className="group relative">
                <img src={u} alt="" className="h-24 w-full object-cover border dark:border-dark-border rounded" />
                <button
                  type="button"
                  onClick={() => removeChainImage(u)}
                  className="absolute right-1 top-1 hidden rounded-md bg-white/90 dark:bg-dark-card/90 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-100 shadow group-hover:block"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Up to 6 images. The first one appears in the feed.</p>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button className="rounded-lg border dark:border-dark-border bg-white dark:bg-dark-card px-4 py-1.5 dark:text-neutral-100" onClick={onCancel}>
          Cancel
        </button>
        <button className="rounded-lg bg-neutral-900 dark:bg-white px-4 py-1.5 text-white dark:text-neutral-900" onClick={create} disabled={busy}>
          Create
        </button>
      </div>
    </div>
  );
}
function Leaderboard({ chainsForBoard }: { chainsForBoard: ChainSummary[] }) {
  const totalLikes = chainsForBoard.reduce((acc, c) => acc + c.likes, 0);
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h2 className="text-xl font-semibold">Top Contributors</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Real leaderboard coming soon.</p>
      <div className="mt-3 p-2 text-sm text-neutral-700 dark:text-neutral-200">
        Total chain likes so far: <strong>{totalLikes}</strong>
      </div>
    </div>
  );
}
