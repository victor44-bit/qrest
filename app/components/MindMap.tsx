"use client";

import * as React from "react";

// keep this light; you can replace with your real type later
export type WithId = { id?: string; _id?: string };
export type Contribution = WithId & {
  text: string;
  author?: string;
  likes: number;
  createdAt: string | number | Date;
};
export type Chain = WithId & {
  title: string;
  tags: string[];
  likes: number;
  createdAt: string | number | Date;
  contributions: Contribution[];
};

type MindMapProps = { chain: Chain };

export default function MindMap({ chain }: MindMapProps): JSX.Element {
  // placeholder render — replace with your actual mind map
  return (
    <div className="rounded-xl border border-neutral-200 p-4">
      <div className="text-sm text-neutral-500">Mind Map (placeholder)</div>
      <div className="mt-1 font-semibold">{chain.title}</div>
      <div className="mt-2 text-xs text-neutral-600">
        {chain.contributions.length} contributions
      </div>
    </div>
  );
}
