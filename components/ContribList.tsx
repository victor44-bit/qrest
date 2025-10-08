'use client'

type Props = {
  chainId: string
  contributions: { 
    _id: string
    text: string
    author?: string | null
    likes: number
    createdAt: string 
  }[]
  onLike: (mid: string) => void
}

export default function ContribList({ chainId, contributions, onLike }: Props) {
  return (
    <ul className="max-h-72 overflow-auto divide-y divide-slate-200 dark:divide-[#1a1a24]">
      {contributions.map((m) => (
        <li
          key={m._id}
          className="p-4 bg-white dark:bg-[#0d0d10]"
        >
          <div className="flex items-start justify-between gap-4">
            <p className="leading-relaxed text-slate-900 dark:text-[#e6e6eb]">
              {m.text}
            </p>
            <button
              onClick={() => onLike(m._id)}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs
                         dark:border-[#1a1a24] dark:bg-[#111218] dark:text-[#e6e6eb] dark:hover:bg-[#15161b]"
            >
              ❤ {m.likes}
            </button>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-[#a0a3ab]">
            by {m.author || 'Anonymous'} • {new Date(m.createdAt).toLocaleString()}
          </div>
        </li>
      ))}
    </ul>
  )
}
