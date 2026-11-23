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

    // Plain text (preserve line breaks). A run of underscores is a fill-in
    // blank: drawn as one unbroken line, since fonts leave gaps between "_".
    return (
      <span key={i} className="whitespace-pre-wrap">
        {part.split(/(_{3,})/).map((piece, j) =>
          /^_{3,}$/.test(piece) ? (
            <span
              key={j}
              role="img"
              aria-label="blank"
              className="mx-0.5 inline-block border-b-2 border-current align-baseline"
              style={{ width: `${Math.max(piece.length * 0.6, 3)}em` }}
            />
          ) : (
            piece
          )
        )}
      </span>
    );
  });
}

export default function MathDisplay({
  text,
  className = "",
}: MathDisplayProps) {
  return (
    <div className={`space-y-1 ${className || "text-sm text-slate-800"}`}>
      {parseMath(text)}
    </div>
  );
}