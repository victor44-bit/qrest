'use client'

import { useState } from 'react'

function clampOneSentence(text: string) {
  const m = text.match(/[^.!?\n]+[.!?]?/)
  return m ? m[0].trim() : text.trim()
}

export default function Composer({ chainId, onPosted }: { chainId: string, onPosted: ()=>void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="p-4 border-t border-slate-200">
      <label className="text-sm">Add a one‑sentence idea</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 240))}
        placeholder="Keep it to one sentence…"
        className="w-full mt-1 rounded-2xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
        rows={3}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{text.length}/240</span>
        <span>Tip: Only the first sentence will be posted.</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={loading} onClick={async () => {
          const one = clampOneSentence(text)
          if (!one) return
          setLoading(true)
          await fetch(`/api/chains/${chainId}/contributions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: one })
          })
          setLoading(false)
          setText('')
          onPosted()
        }} className="rounded-xl bg-slate-900 text-white px-4 py-2 hover:opacity-95">{loading ? 'Posting…' : 'Post'}</button>
        <button onClick={() => setText('')} className="rounded-xl border border-slate-300 px-4 py-2 hover:bg-slate-50">Clear</button>
      </div>
    </div>
  )
}
