# Qrest — README

A lightweight social “idea chains” app built with **Next.js (App Router)**, **TypeScript**, **Prisma (MongoDB)**, and **Tailwind CSS**. Users can start idea chains, contribute, like, and view a mind-map of the discussion. The UI is mobile-first with a simple bottom nav, search/filters, and an infinite-ish feed.

---

## Features

* **Feed & detail views**

  * Feed shows title, tags, author, created time, likes, views, cover image.
  * Detail page supports contributions, nested replies, likes (per-contribution limits), image attachments, and a **MindMap** view.
* **Views & Likes**

  * Optimistic UI updates.
  * Client de-dup for view counts (30-min window) to avoid inflated metrics.
* **Auth (minimal)**

  * Uses a `qrest_user` cookie with `{ id }`. Endpoints check this for authenticated operations (create, delete, etc.).
* **Uploads**

  * `/api/uploads` receives multi-file images and returns public URLs (plug in your storage).
* **Dark mode**

  * Via Tailwind’s `class` strategy and a `ThemeToggle` component.

---

## Tech Stack

* **Next.js** (App Router), **React**, **TypeScript**
* **Prisma** (MongoDB provider)
* **Tailwind CSS**
* Optional: your object storage (e.g., S3/ImageKit) wired behind `/api/uploads`.

---

## Project Structure

```
app/
  api/
    auth/
      me/route.ts         # returns current user (reads qrest_user cookie)
      logout/route.ts
      ...login|signup...  # your implementation (links from header)
      admin/
    page.tsx                  # Admin dashboard UI
  api/
    admin/
      users/
        route.ts              # GET list + total
        [id]/
          route.ts            # DELETE user
    chains/
      route.ts            # GET feed, POST create chain
      [id]/
        route.ts          # GET one chain, POST like, DELETE chain
        views/route.ts    # POST bump view counter
        contributions/
          route.ts        # POST add contribution
          [contribId]/
            like/route.ts # POST like contribution
            replies/
              route.ts    # GET/POST replies for contrib
    uploads/route.ts      # POST image uploads -> { urls: string[] }
  home/
    page.tsx              # (if you have a home route using a smaller feed)
  page.tsx                # Main app page: Feed + Detail + MindMap tabs
components/
  MindMap.tsx
  ThemeToggle.tsx
lib/
  prisma.ts               # Prisma client
prisma/
  schema.prisma
public/
styles/
  globals.css
```
---

## Getting Started

### 1) Prerequisites

* Node.js 18+
* MongoDB (Atlas or local)

### 2) Install dependencies

```bash
pnpm install
# or
npm install
# or
yarn
```

### 3) Environment variables

Create a `.env` file at the project root:

```env
# Prisma (MongoDB)
DATABASE_URL="mongodb+srv://user:pass@cluster/dbname?retryWrites=true&w=majority"

# App URL (for share links, CORS, etc.)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# If your /api/uploads uses external storage, add your keys here
# IMAGEKIT_PUBLIC_KEY=""
# IMAGEKIT_PRIVATE_KEY=""
# IMAGEKIT_ENDPOINT=""
```

### 4) Prisma setup

```bash
npx prisma generate
# If you add relational-like changes, ensure schema.prisma is in MongoDB mode
```

> This project uses MongoDB with Prisma. Some advanced aggregations use `aggregateRaw` where needed.

### 5) Run the dev server

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## Scripts

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "prisma:generate": "prisma generate",
    "prisma:studio": "prisma studio"
  }
}
```

---

## Data Model (high level)

Mongo collections behind Prisma models:

* **Chain**

  * `id`, `title`, `tags[]`, `likes`, `views`, `images[]`, `authorId`, `createdAt`
* **Contribution**

  * `id`, `chainId`, `text`, `images[]`, `likes`, `authorId`, `authorName`, `createdAt`, `parentId` (for replies)
* **User**

  * `id`, `email`, `name`, etc. (your auth layer)

> The feed uses a lookup to count contributions per chain. Views are simple counters.

---

## Key Frontend Files

### `app/page.tsx`

* The main client page handling:

  * Tabs: **Feed**, **New**, **Leaderboard**, **Map**
  * Search tray (query + tag filter + scope All/Mine)
  * Local state for feed, selection, errors, etc.
  * Fetchers:

    * `loadFeed(scope)` → `/api/chains` or `/api/chains/mine`
    * `loadOne(id)` → `/api/chains/[id]`
    * `bumpChainView(id)` → `/api/chains/[id]/views` (with 30-min de-dup via `localStorage`)
  * Components:

    * `FeedView` — list of chains (author avatar letter, title, tags, likes, views, share)
    * `ChainDetail` — chain detail + contributions + replies + mind map toggle
    * `MapOnly` — mind map page-only loader
    * `NewChain` — create chain form
    * `Header`, `BottomNav`, `Leaderboard`

### LocalStorage keys

* `qrest_contrib_likes` — track likes a user has given *per contribution* (client-side limit).
* `qrest_chain_viewed_at` — timestamps per chain to throttle view increments.

---

## API Endpoints

### Chains

* `GET /api/chains`

  * Returns feed (sorted by `createdAt desc`).
* `GET /api/chains/mine`

  * Same shape, but requires login (checks `qrest_user` cookie).
* `POST /api/chains`

  * **Auth required**. Body: `{ title: string, tags: string[], images?: string[] }`
  * Creates a new chain (likes/views set to 0).
* `GET /api/chains/:id`

  * Returns one chain with contributions (flattened roots; UI re-nests replies via `parentId` where applicable).
* `POST /api/chains/:id`

  * Like a chain (optimistic UI in the client).
* `DELETE /api/chains/:id`

  * **Auth required**. Delete chain and its contributions (server should enforce ownership).
* `POST /api/chains/:id/views`

  * Increments views (client throttles calls with 30-min window).

### Contributions

* `POST /api/chains/:id/contributions`

  * Add a contribution. Body: `{ text: string, images?: string[] }`
* `POST /api/chains/:id/contributions/:contribId/like`

  * Optimistically increments like; client prevents spamming (limit per contribution).

### Replies

* `GET /api/chains/:id/contributions/:rootId/replies?take=10&cursor=...`

  * Cursor-based pagination for replies to a contribution.
* `POST /api/chains/:id/contributions/:rootId/replies`

  * Add a reply. Body: `{ parentId: string, text: string }`

### Uploads

* `POST /api/uploads`

  * Multipart form-data: `files[]`.
  * Response: `{ urls: string[] }` (wire to S3/ImageKit/Cloudinary in your implementation).

### Auth (minimal)

* `GET /api/auth/me` → `{ user: { id, email, name } | null }`
* `POST /api/auth/logout` → clears session/cookie
* **/login** and **/signup** are linked from the header (implement as you like).
  The app expects the `qrest_user` cookie with a JSON payload `{ id: string }`.

---

## Example Requests

```bash
# Get feed
curl http://localhost:3000/api/chains

# Create a chain (requires qrest_user cookie)
curl -X POST http://localhost:3000/api/chains \
  -H "Content-Type: application/json" \
  -H 'Cookie: qrest_user={"id":"abc123"}' \
  -d '{"title":"My first idea","tags":["tech","fun"],"images":[]}'

# Like a chain
curl -X POST http://localhost:3000/api/chains/<id>

# Add contribution
curl -X POST http://localhost:3000/api/chains/<id>/contributions \
  -H "Content-Type: application/json" \
  -d '{"text":"I have a thought...","images":[]}'
```

---

## Styling & UX Notes

* Tailwind CSS classes for theming; dark mode via `class` (e.g. `dark:bg-dark-bg`).
* **ThemeToggle** integrates with `next-themes`.
* Feed item shows:

  * Left column “profile” circle containing the author’s first letter.
  * A subtle vertical red guide line that shortens when a cover image is present.
  * “Open” button, and a share button with Web Share API + clipboard fallback.
* Mind map uses `components/MindMap.tsx` (pure client component).

---

## Deployment

* **Vercel** recommended.
* Add **Environment Variables** in dashboard:

  * `DATABASE_URL`
  * Any storage keys used by `/api/uploads`
  * `NEXT_PUBLIC_APP_URL`
* Build command: `next build`
* Start command (local/Node servers): `next start`

---

## Testing (suggested)

* Unit test utilities (e.g., `timeAgo`, `formatCount`).
* API route tests with mocked Prisma client.
* UI tests with Playwright (feed renders; can open detail; can post contribution with mock server).

---

## Security & Production Considerations

* Replace the demo cookie-based auth with a robust solution (NextAuth, custom JWT, etc.).
* Rate-limit endpoints (`views`, `likes`, posting) with an IP/session limiter.
* Sanitize image uploads and constrain file size/types on `/api/uploads`.
* Server-side authz checks:

  * Only authors (or admins) can delete their chains/contributions.
* Consider server-side pagination for the main feed if it grows.

---

## Troubleshooting

* **Feed doesn’t load / 500 on `/api/chains`**

  * Check `DATABASE_URL` and Prisma connectivity (`prisma:studio`).
* **Creating chains returns 401**

  * Ensure `qrest_user` cookie with a JSON `{ id }` is set (your login flow).
* **Images don’t appear after upload**

  * Confirm `/api/uploads` returns a JSON with `{ urls: string[] }` and those URLs are publicly accessible.
* **Views never increase**

  * The client throttles by `localStorage["qrest_chain_viewed_at"]`. Clear it or wait 30 minutes to see another increment.

---

## Contributing

1. Fork & create a feature branch.
2. Keep PRs small and focused (UI, API, or data layer).
3. Include a short description and screenshots/GIFs for UI changes.

---

## License

MIT — do what you want; attribution appreciated.
