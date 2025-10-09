"use client";

import React, { useState, useEffect } from "react";
import clsx from "clsx";

interface CollapsibleTextProps {
  text: string;
  clampLines?: number;
  className?: string;
}

export default function CollapsibleText({
  text,
  clampLines = 3,
  className,
}: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const [elementHeight, setElementHeight] = useState<number | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      const fullHeight = ref.current.scrollHeight;
      const lineHeight = parseFloat(getComputedStyle(ref.current).lineHeight);
      const maxHeight = clampLines * lineHeight;
      setNeedsClamp(fullHeight > maxHeight);
      setElementHeight(fullHeight);
    }
  }, [text, clampLines]);

  return (
    <div>
      <div
        ref={ref}
        className={clsx(className, !expanded && `line-clamp-${clampLines}`)}
      >
        {text}
      </div>
      {needsClamp && (
        <button
          className="text-blue-500 hover:underline mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
