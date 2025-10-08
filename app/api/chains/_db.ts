export type Contribution = {
  id: string
  text: string
  author?: string
  likes: number
  createdAt: number
}

export type Chain = {
  id: string
  title: string
  tags: string[]
  likes: number
  createdAt: number
  contributions: Contribution[]
}

export const db: { chains: Chain[] } = {
  chains: []
}

export const makeId = () => String(Date.now())
