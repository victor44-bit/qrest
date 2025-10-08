export type WithId = { id: string };
export type Contribution = WithId & {
  text: string;
  author?: string;
  likes: number;
  createdAt: string;
};
export type Chain = WithId & {
  title: string;
  tags: string[];
  likes: number;
  createdAt: string;
  contributions: Contribution[];
};

export type User = WithId & {
  name: string;
  email: string;
  password: string; // demo only (plaintext). Replace with bcrypt in production.
  createdAt: string;
};

export const db: { chains: Chain[]; users: User[] } = {
  chains: [
    {
      id: "seed-1",
      title: "What if shoes could charge your phone while you walk?",
      tags: ["tech", "sustainability"],
      likes: 3,
      createdAt: new Date().toISOString(),
      contributions: [
        { id: "c1", text: "Use piezoelectric insoles for trickle charging.", likes: 2, author: "DemoUser", createdAt: new Date().toISOString() },
        { id: "c2", text: "Add a tiny buffer battery + USB-C dock.", likes: 1, author: "DemoUser", createdAt: new Date().toISOString() }
      ]
    }
  ],
  users: [
    {
      id: "u1",
      name: "DemoUser",
      email: "demo@example.com",
      password: "password", // demo only
      createdAt: new Date().toISOString()
    }
  ]
};

export function makeId(): string {
  const s = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return s;
}