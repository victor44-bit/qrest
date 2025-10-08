'use client'

import { useState } from 'react'

export default function StartChain({ onCreated }: { onCreated: ()=>void }) {
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')

  return (
    <section className="bg-white shadow-sm rounded-2xl p-4 border border-slate-200">
      <h2 className="font-semibold mb-3">Start a Chain</h2>
      <label className="text-sm">Seed idea</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Eco‑friendly shoes" className="w-full mt-1 mb-3 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
      <label className="text-sm">Tags (comma‑separated)</label>
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tech, art, education" className="w-full mt-1 mb-3 rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
      <button onClick={async () => {
        if (!title.trim()) return
        const t = tags.split(',').map(s => s.trim()).filter(Boolean)
        await fetch('/api/chains', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title: title.trim(), tags: t }) })
        setTitle(''); setTags(''); onCreated()
      }} className="w-full rounded-xl bg-slate-900 text-white py-2.5 hover:opacity-95">Create Chain</button>
      <p className="text-xs text-slate-500 mt-2">One idea seed per chain. Keep it short and punchy.</p>
    </section>
  )
}
