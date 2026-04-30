"use client";

import { InlineMath, BlockMath } from "react-katex";

type MathDisplayProps = {
  text: string;
  className?: string;
};

function parseMath(text: string) {
  // Match both inline \( ... \) and block \[ ... \]
  const regex = /(\\\[.*?\\\]|\\\(.*?\\\))/g;

  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, i) => {
    // Block math
    if (part.startsWith("\\[") && part.endsWith("\\]")) {
      const math = part.slice(2, -2).trim();
      return (
        <div key={i} className="my-1 overflow-x-auto">
          <BlockMath math={math} />
        </div>
      );
    }

    // Inline math
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      let math = part.slice(2, -2);
      // Convert x/y to \frac{x}{y}
      math = math.replace(/(\d+|[xtXT])\/(\d+|[xtXT])/g, "\\frac{$1}{$2}");
      return <InlineMath key={i} math={math} />;
    }

    // Plain text (preserve line breaks)
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part}
      </span>
    );
  });
}

export default function MathDisplay({
  text,
  className = "",
}: MathDisplayProps) {
  return (
    <div className={`text-slate-800 space-y-1 text-sm ${className}`}>
      {parseMath(text)}
    </div>
  );
}