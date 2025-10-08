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
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Heuristic: show "See more" if content is likely > 5 lines (or very long).
  const isLong = (s: string) => {
    if (!s) return false;
    const chars = s.length;
    const lines = s.split(/\r?\n/).length;
    return chars >= 280 || lines > 5;
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
        const expanded = expandedIds.has(id);
        const long = isLong(c.title ?? "");

        return (
          <article key={id} className="pb-4 border-b dark:border-dark-border relative">
            {/* Red line from profile to bottom */}
            <div
              className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-red-500 z-0 pointer-events-none"
              style={{
                clipPath: cover
                  ? "polygon(0 0, 100% 0, 100% calc(100% - 60px), 0 calc(100% - 60px))"
                  : "none",
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
                      expanded ? "" : "clamped-5"  /* <- custom clamp from globals.css */
                    }`}
                  >
                    {c.title}
                  </h3>

                  {long && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(id);
                      }}
                      className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
                    >
                      {expanded ? "See less" : "See more"}
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
                <img src={cover} alt="" className="w-full max-h-64 object-cover rounded-lg" />
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
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Touch me (please)</span>
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
                  const ta = document.createElement("textarea");
                  ta.value = url;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  document.body.appendChild(ta);
                  ta.select();
                  let ok = false;
                  try { ok = document.execCommand("copy"); } catch {}
                  document.body.removeChild(ta);
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.innerHTML = ok ? "✓ Copied" : "✗";
                  setTimeout(() => { if (btn.isConnected) btn.innerHTML = "↗"; }, 1500);
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
