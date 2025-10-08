"use client";
import * as React from "react";

export default function ContributionImages({ urls }: { urls?: string[] }) {
  if (!urls || urls.length === 0) return null;
  const u = urls.slice(0, 6);
  const cols = u.length === 1 ? "grid-cols-1" : u.length <= 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`mt-2 grid ${cols} gap-2`}>
      {u.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-lg border">
          <img
            src={src}
            alt={`img-${i}`}
            className="h-36 w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
