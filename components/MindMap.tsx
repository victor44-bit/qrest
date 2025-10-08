"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

/** ===== Types ===== */
type WithId = { id?: string; _id?: string };
type Contribution = WithId & {
  text: string;
  likes: number;
  createdAt: string | number | Date;
  authorName?: string | null;
  parentId?: string | null;   // replies have this set
  replyCount?: number;        // direct child count (optional)
};
type Chain = WithId & {
  title: string;
  likes: number;
  tags?: string[];
  contributions?: Contribution[];
};

/** ===== Helpers ===== */
const getAnyId = (o: WithId) => String((o && (o.id ?? o._id)) ?? "");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const now = () => new Date().getTime();
const toDate = (d: any) => {
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) ? new Date() : x;
};
const daysAgo = (d: any) => (now() - toDate(d).getTime()) / (1000 * 60 * 60 * 24);
const hashColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 80% 55%)`;
};
const safeTags = (tags: unknown): string[] => (Array.isArray(tags) ? (tags as string[]) : []);
const safeContribs = (v: unknown): Contribution[] => (Array.isArray(v) ? (v as Contribution[]) : []);

/** Heat & visuals */
const heatScore = (likes: number, replies: number) => (likes || 0) * 2 + (replies || 0) * 3;
const heatToScale = (heat: number) => 1 + clamp(heat, 0, 40) / 100;
const heatToGlow = (heat: number) => clamp(heat * 1.5 + 8, 10, 60);
const heatToDripCount = (heat: number) => (heat > 12 ? 2 : heat > 6 ? 1 : 0);

/** Layout (mobile-friendly) */
const ORB_R_DESKTOP = 30;
const ORB_R_MOBILE = 24;
const H_GAP_DESKTOP = 220;
const H_GAP_MOBILE = 180;
const V_GAP_DESKTOP = 110;
const V_GAP_MOBILE = 96;
const COLUMN_MAX = 6;

/** ===== On-device taste model ===== */
type Taste = { kw: Record<string, number>; tags: Record<string, number>; decay: number; t: number };
const TASTE_KEY = "qrest_taste_v1";

const tokenize = (s: string): string[] =>
  String(s).toLowerCase().replace(/[^a-z0-9\s#@\-\.]/g, " ").split(/\s+/).filter(Boolean).slice(0, 80);

const loadTaste = (): Taste => {
  try {
    const raw = localStorage.getItem(TASTE_KEY);
    if (!raw) return { kw: {}, tags: {}, decay: 0.985, t: now() };
    const t = JSON.parse(raw) as Taste;
    return { decay: 0.985, t: now(), kw: t.kw || {}, tags: t.tags || {} };
  } catch {
    return { kw: {}, tags: {}, decay: 0.985, t: now() };
  }
};
const saveTaste = (t: Taste) => {
  try {
    localStorage.setItem(TASTE_KEY, JSON.stringify(t));
  } catch {}
};

const bump = (m: Record<string, number>, key: string, by = 1) => {
  if (key) m[key] = (m[key] || 0) + by;
};
const decayMap = (m: Record<string, number>, factor: number) => {
  for (const k of Object.keys(m));
};
const updateTasteFromText = (t: Taste, text: string, amt = 1) => tokenize(text).forEach((w) => bump(t.kw, w, amt));
const updateTasteFromTags = (t: Taste, tags: string[], amt = 2) => tags.forEach((tag) => bump(t.tags, tag.toLowerCase(), amt));
const applyDecay = (t: Taste) => {
  decayMap(t.kw, t.decay);
  decayMap(t.tags, t.decay);
  t.t = now();
};
const cosineLike = (vec: Record<string, number>, toks: string[]) => toks.reduce((s, w) => s + (vec[w] || 0), 0);
const tagsScore = (vec: Record<string, number>, tags: string[]) => tags.reduce((s, tg) => s + (vec[tg.toLowerCase()] || 0), 0);

/** Scoring */
const scoreNode = (n: Contribution, taste: Taste, chainTags: string[]): number => {
  const replies = n.replyCount ?? 0;
  const heat = heatScore(n.likes ?? 0, replies);
  const kw = tokenize(n.text || "");
  const affinity = cosineLike(taste.kw, kw) * 0.8 + tagsScore(taste.tags, chainTags) * 1.2;
  const ageD = daysAgo(n.createdAt);
  const recency = ageD <= 7 ? (1 - ageD / 7) * 6 : 0;
  const lengthBonus = Math.min(kw.length / 50, 1.5);
  return heat + affinity + recency + lengthBonus;
};

/** ===== Component ===== */
type MindMapProps = { chain: Chain };

export default function MindMap({ chain }: MindMapProps) {
  const chainId = getAnyId(chain);
  const [mode, setMode] = React.useState<"foryou" | "latest">("foryou");
  const [taste, setTaste] = React.useState<Taste>(() => loadTaste());

  // ✅ No optional access; no useMemo deps that touch optional fields.
  const chainTags: string[] = safeTags((chain as any).tags);
  const contributionsSafe: Contribution[] = safeContribs((chain as any).contributions);

  // Responsive sizes
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const ORB_R = isMobile ? ORB_R_MOBILE : ORB_R_DESKTOP;
  const H_GAP = isMobile ? H_GAP_MOBILE : H_GAP_DESKTOP;
  const V_GAP = isMobile ? V_GAP_MOBILE : V_GAP_DESKTOP;

  // Prime taste once per chain render
  React.useEffect(() => {
    const t = loadTaste();
    applyDecay(t);
    updateTasteFromText(t, (chain as any).title || "", 1.5);
    updateTasteFromTags(t, chainTags, 1.5);
    saveTaste(t);
    setTaste(t);
    // No deps referencing optional fields directly; we serialize safe values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, JSON.stringify(chainTags)]);

  // Roots = only top-level
  const rootsRaw = React.useMemo(() => contributionsSafe.filter((c) => !c.parentId), [contributionsSafe]);

  const roots = React.useMemo(() => {
    if (mode !== "foryou") {
      // Latest: recency first, then heat
      return [...rootsRaw].sort((a, b) => {
        const x = +toDate(b.createdAt) - +toDate(a.createdAt);
        if (x !== 0) return x;
        const hb = heatScore(b.likes ?? 0, b.replyCount ?? 0);
        const ha = heatScore(a.likes ?? 0, a.replyCount ?? 0);
        return hb - ha;
      });
    }
    // For You: personalized score
    return [...rootsRaw].sort((a, b) => scoreNode(b, taste, chainTags) - scoreNode(a, taste, chainTags));
  }, [rootsRaw, mode, taste, JSON.stringify(chainTags)]);

  /** children cache & open state */
  const [children, setChildren] = React.useState<Record<string, Contribution[]>>({});
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const getChildren = React.useCallback((id: string): Contribution[] => children[id] ?? [], [children]);
  const isOpen = React.useCallback((id: string): boolean => Boolean(open[id]), [open]);

  /** fetch direct replies for a parent */
  const fetchReplies = async (rootContribId: string, parentId: string, parentText: string) => {
    setLoading((m) => ({ ...m, [parentId]: true }));
    setErrors((m) => ({ ...m, [parentId]: "" }));
    try {
      const url = `/api/chains/${chainId}/contributions/${rootContribId}/replies?take=50`;
      const res = await fetch(url, {
        headers: { "x-parent-id": parentId },
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Failed to load (${res.status})`;
        try {
          const d = await res.json();
          if (d?.error) msg += `: ${d.error}`;
        } catch {}
        throw new Error(msg);
      }
      const data = (await res.json()) as { items: Contribution[]; nextCursor: string | null };
      const kids = safeContribs((data as any)?.items);

      // Learn from parent they expanded
      const t = loadTaste();
      applyDecay(t);
      updateTasteFromText(t, parentText || "", 2.5);
      updateTasteFromTags(t, chainTags, 1.5);
      saveTaste(t);
      setTaste(t);

      setChildren((m) => ({
        ...m,
        [parentId]:
          mode === "foryou"
            ? kids.slice().sort((a, b) => scoreNode(b, t, chainTags) - scoreNode(a, t, chainTags))
            : kids.slice().sort((a, b) => +toDate(b.createdAt) - +toDate(a.createdAt)),
      }));
    } catch (e: any) {
      setErrors((m) => ({ ...m, [parentId]: e?.message ?? "Failed to load" }));
    } finally {
      setLoading((m) => ({ ...m, [parentId]: false }));
    }
  };

  /** toggle */
  const onToggle = (node: Contribution, rootId: string) => {
    const nid = getAnyId(node);
    setOpen((m) => ({ ...m, [nid]: !m[nid] }));
    if (!children[nid]) {
      void fetchReplies(rootId, nid, node.text || "");
    }

    // micro learning
    const t = loadTaste();
    applyDecay(t);
    updateTasteFromText(t, node.text || "", 1.2);
    updateTasteFromTags(t, chainTags, 0.8);
    saveTaste(t);
    setTaste(t);
  };

  /** ===== Layout (columns) with guards ===== */
  type Placed = Contribution & { x: number; y: number; depth: number; rootId: string };

  const [placed, edges] = React.useMemo(() => {
    const placed: Placed[] = [];
    const edges: Array<{ from: Placed; to: Placed }> = [];

    // column 1: roots
    const col1: Placed[] = roots.slice(0, COLUMN_MAX).map((c, i) => ({
      ...c,
      rootId: getAnyId(c),
      depth: 1,
      x: H_GAP,
      y: i * V_GAP + (isMobile ? 20 : 40),
    }));
    placed.push(...col1);

    const visited = new Set<string>();
    const MAX_DEPTH = 6;

    const placeKids = (parent: Placed, depth: number) => {
      if (depth > MAX_DEPTH) return;
      const pid = getAnyId(parent);
      const kidsSafe = isOpen(pid) ? getChildren(pid) : [];
      if (!kidsSafe.length) return;

      const columnX = (depth + 1) * H_GAP;
      const centerShift = Math.floor(kidsSafe.length / 2);

      kidsSafe.slice(0, COLUMN_MAX).forEach((k, idx) => {
        const kidId = getAnyId(k);
        if (!kidId || visited.has(`${pid}->${kidId}`)) return;
        visited.add(`${pid}->${kidId}`);

        const node: Placed = {
          ...k,
          depth: depth + 1,
          rootId: parent.rootId,
          x: columnX,
          y: parent.y + (idx - centerShift) * (V_GAP * 0.9),
        };
        placed.push(node);
        edges.push({ from: parent, to: node });

        if (isOpen(kidId)) placeKids(node, depth + 1);
      });
    };

    col1.forEach((root) => {
      // Edge from left “fire” gutter to first column
      edges.push({
        from: {
          ...root,
          x: 0,
          y: root.y,
          depth: 0,
          rootId: root.rootId,
          text: (chain as any).title || "",
          likes: (chain as any).likes || 0,
        } as Placed,
        to: root,
      });
      placeKids(root, 1);
    });

    return [placed, edges] as const;
  }, [roots, getChildren, isOpen, chainId, H_GAP, V_GAP, isMobile]);

  /** ===== Node visuals ===== */
  const Node: React.FC<{
    node: Placed;
    onClick: () => void;
    isOpen: boolean;
    isRoot: boolean;
  }> = ({ node, onClick, isOpen, isRoot }) => {
    const id = getAnyId(node);
    const replies = (node as any).replyCount ?? getChildren(id).length;
    const heat = heatScore(node.likes ?? 0, replies);
    const scale = heatToScale(heat);
    const blur = heatToGlow(heat);
    const drips = heatToDripCount(heat);
    const hueBorder = hashColor(id);

    return (
      <motion.div
        layout
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale }}
        whileHover={{ scale: scale * 1.03 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative cursor-pointer select-none"
        style={{ transformOrigin: "center" }}
        role="button"
        tabIndex={0}
      >
        <div
          style={{
            position: "absolute",
            inset: -10,
            filter: `blur(${blur}px)`,
            borderRadius: 999,
            background:
              heat > 8
                ? "conic-gradient(from 140deg, #ff7a00, #ff006e, #ff7a00)"
                : "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.14), rgba(0,0,0,0))",
            opacity: 0.9,
          }}
        />
        <div
          className="grid place-items-center rounded-full bg-white shadow-xl"
          style={{
            width: ORB_R * 2,
            height: ORB_R * 2,
            border: `3px solid ${hueBorder}`,
            boxShadow:
              heat > 6
                ? "0 8px 24px rgba(255, 0, 110, 0.25), inset 0 0 20px rgba(255, 122, 0, 0.25)"
                : "0 6px 18px rgba(0,0,0,0.12)",
          }}
          title={`${replies} repl${replies === 1 ? "y" : "ies"} • ${node.likes ?? 0} likes`}
        >
          <div className={isMobile ? "text-xl" : "text-2xl"}>
            {heat > 10 ? "🔥" : heat > 5 ? "♨️" : "💡"}
          </div>
        </div>

        <AnimatePresence>
          {drips > 0 &&
            new Array(drips).fill(0).map((_, i) => (
              <motion.div
                key={`drip-${id}-${i}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 0.9, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: 0.1 * i, duration: 0.25 }}
                className="pointer-events-none absolute left-1/2 top-[56px]"
                style={{ transform: `translateX(${(i - (drips - 1) / 2) * 10}px)` }}
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                  <path d="M5 0 C2.5 6 0 8.5 0 12a5 5 0 1 0 10 0C10 8.5 7.5 6 5 0z" fill="url(#g)" opacity="0.9" />
                  <defs>
                    <linearGradient id="g" x1="0" x2="0" y1="0" y2="18">
                      <stop offset="0%" stopColor="#ff7a00" />
                      <stop offset="100%" stopColor="#ff006e" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            ))}
        </AnimatePresence>

        <div
          className={`pointer-events-none absolute left-1/2 ${isMobile ? "top-[64px] w-[200px]" : "top-[68px] w-[240px]"} -translate-x-1/2 rounded-xl border bg-white/90 px-3 py-2 text-xs shadow backdrop-blur`}
          style={{ borderColor: hueBorder }}
        >
          <div className="line-clamp-3 whitespace-pre-wrap leading-snug text-neutral-800">{node.text}</div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-500">
            <span className="rounded-full bg-neutral-100 px-2 py-[2px]">{node.authorName ?? "Anon"}</span>
            <span className="rounded-full bg-orange-50 px-2 py-[2px] text-orange-700">
              {replies} repl{replies === 1 ? "y" : "ies"}
            </span>
            <span className="rounded-full bg-pink-50 px-2 py-[2px] text-pink-700">▲ {node.likes ?? 0}</span>
            <span className="ml-auto text-[10px]">{isRoot ? (isOpen ? "Collapse" : "Expand") : (isOpen ? "Collapse" : "Reply thread")}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  /** Canvas size */
  const maxDepth = Math.max(1, ...placed.map((p) => p.depth || 1));
  const width = Math.max(900, (maxDepth + 1) * H_GAP + 220);
  const maxColFill = Math.max(roots.length, ...Object.values(children).map((a) => (Array.isArray(a) ? a.length : 0)));
  const height = Math.max(600, (maxColFill + 1) * V_GAP + (isMobile ? 120 : 180));

  return (
    <div className="relative overflow-auto rounded-2xl border border-neutral-200 bg-neutral-50">
      {/* Banner */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-black px-2 py-1 text-xs text-white">TRENDING</span>
          <h3 className="line-clamp-2 whitespace-pre-wrap text-lg font-semibold">{(chain as any).title || ""}</h3>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="rounded-xl border border-neutral-300 bg-white p-1">
            <button
              onClick={() => setMode("foryou")}
              className={`rounded-lg px-3 py-1 text-sm ${mode === "foryou" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
              title="Personalized order"
            >
              🔮 For You
            </button>
            <button
              onClick={() => setMode("latest")}
              className={`rounded-lg px-3 py-1 text-sm ${mode === "latest" ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-50"}`}
              title="Newest first"
            >
              🕒 Latest
            </button>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">▲ {(chain as any).likes ?? 0}</span>
        </div>
      </div>

      {/* Map plane */}
      <div style={{ width, height }} className="relative">
        {/* Left fire gutter */}
        <div className="absolute left-0 top-0 grid h-full w-[80px] place-items-center md:w-[100px]">
          <div className="select-none text-4xl md:text-5xl" title="Trending heat">🔥</div>
        </div>

        {/* Edges */}
        <svg className="absolute inset-0" width={width} height={height}>
          <defs>
            <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff7a00" />
              <stop offset="100%" stopColor="#ff006e" />
            </linearGradient>
          </defs>
          {edges.map(({ from, to }, i) => {
            const x1 = from.depth === 0 ? 90 : from.x + ORB_R;
            const y1 = (from as any).y + ORB_R;
            const x2 = to.x + ORB_R;
            const y2 = to.y + ORB_R;
            const midX = (x1 + x2) / 2;
            const path = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
            return <path key={i} d={path} stroke="url(#edge)" strokeWidth={2.5} fill="none" opacity={0.55} />;
          })}
        </svg>

        {/* Nodes */}
        {placed.map((p) => {
          const id = getAnyId(p);
          const isRoot = p.depth === 1;
          const rootId = isRoot ? id : p.rootId;
          return (
            <div key={id} style={{ position: "absolute", left: p.x, top: p.y }}>
              <Node node={p} isOpen={isOpen(id)} isRoot={isRoot} onClick={() => onToggle(p, rootId)} />
              <div className="absolute left-1/2 top-[120px] -translate-x-1/2">
                {loading[id] && (
                  <div className="animate-pulse rounded-full bg-neutral-900 px-2 py-[2px] text-[10px] text-white">loading…</div>
                )}
                {!!errors[id] && (
                  <div className="rounded-full bg-red-100 px-2 py-[2px] text-[10px] text-red-700">{errors[id]}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-neutral-200 bg-white/70 px-3 py-2 text-[11px] backdrop-blur">
        <span className="rounded-full bg-white px-2 py-[2px]">🔮 personalized</span>
        <span className="rounded-full bg-white px-2 py-[2px]">🔥 hotter = more glow</span>
        <span className="rounded-full bg-white px-2 py-[2px]">💧 drips show trending heat</span>
        <span className="ml-auto text-neutral-500">Tap any orb to expand</span>
      </div>
    </div>
  );
}
