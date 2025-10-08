export type Contribution = {
  id: string;
  text: string;
  likes: number;
  author?: string;
  createdAt: Date;
};

export type Chain = {
  id: string;
  title: string;
  tags: string[];
  likes: number;
  createdAt: Date;
  contributions: Contribution[];
};

// In-memory “DB”
export const CHAINS: Chain[] = [];

// Helpers
export const findChain = (id: string) => CHAINS.find((c) => c.id === id);
