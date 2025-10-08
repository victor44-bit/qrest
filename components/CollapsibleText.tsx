"use client";
import React from "react";

type Props = {
  text: string;
  clampLines?: number; // default 5
  className?: string;
};

export default function CollapsibleText({ text, clampLines = 5, className = "" }: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const needsClamp = React.useMemo(() => {
    if (!text) return false;
    // Heuristic to decide if "See more" should appear (client-only)
    const approxCharsPerLine = 80;
    const threshold = approxCharsPerLine * clampLines;
    return text.replace(/\r?\n/g, "\n").length > threshold;
  }, [text, clampLines]);

  return (
    <div>
      <div className={`${className} ${!expanded ? \`line-clamp-\${clampLines}\` : ""}`}>
        {text}
      </div>
      {needsClamp && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 hover:underline"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
