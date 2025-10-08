"use client";

type Props = {
  chain: {
    _id: string;
    title: string;
    tags: string[];
    likes: number;
    views: number;            // 👈 NEW
    createdAt: string;
    contributions: any[];
  };
  onLike: () => void;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function ChainCard({ chain, onLike }: Props) {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm
                 dark:border-dark-border dark:bg-dark-card transition-colors duration-300"
    >
      <div className="flex items-start justify-between">
        {/* Left side */}
        <div>
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100">
            {chain.title}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{new Date(chain.createdAt).toLocaleString()}</span>
            <span>•</span>
            <span>{chain.contributions.length} contributions</span>
            <span>•</span>
            <span>{formatCount(chain.views)} views</span> {/* 👈 NEW */}
            <span>•</span>
            <div className="flex flex-wrap gap-1">
              {chain.tags.map((t) => (
                <span
                  key={t}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600
                             dark:bg-[#22303C] dark:text-neutral-300"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Like button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className="shrink-0 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm 
                     hover:bg-neutral-100 dark:border-dark-border dark:text-neutral-100 
                     dark:hover:bg-[#22303C] transition-colors duration-200"
        >
          ❤ {chain.likes}
        </button>
      </div>
    </div>
  );
}
