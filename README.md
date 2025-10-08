# ChainThoughts — MVP (Next.js + Tailwind + Mongoose)

Collaborative one-sentence idea chains.

## Quickstart

1) Create `.env` from `.env.example` and set `MONGODB_URI`.
2) Install deps: `npm install`
3) Run dev: `npm run dev`
4) Open http://localhost:3000

## Stack

- Next.js App Router (TS)
- TailwindCSS
- Mongoose (MongoDB)

## Endpoints

- `GET /api/chains?limit=20` — list chains
- `POST /api/chains` — create `{ title, tags[] }`
- `PATCH /api/chains` — like chain `{ id, op:'like' }`
- `POST /api/chains/:id/contributions` — add one-sentence `{ text }`
- `PATCH /api/chains/:id/contributions` — like contribution `{ id, op:'like' }`
- `GET /api/chains?format=md` — export all to Markdown

## Notes

- One-sentence rule enforced server-side: we keep the first sentence and truncate to 240 chars.
- No auth in MVP. Add NextAuth (or Clerk) later.
- For a mind map, add a `/api/graph/:id` that returns nodes/edges derived from contributions.