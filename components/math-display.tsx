"use client";

import { InlineMath } from "react-katex";

type MathDisplayProps = {
  text: string;
  className?: string;
};

function splitMath(text: string) {
  // match equation-like chunks (simple heuristic)
  const regex =
    /([a-zA-Z]\([^)]*\)\s*=\s*[^.]+|\b[a-zA-Z]\([^)]*\)|\d+\s*[a-zA-Z]?[\^_][^ ]+)/g;

  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, i) => {
    // const isMath =
    //   part.includes("=") ||
    //   part.includes("^") ||
    //   part.includes("_") ||
    //   part.includes("\\frac") ||
    //   part.includes("\\sqrt");

    const isMath =
      /[=^_]/.test(part) ||
      /\\(frac|sqrt|int|sum)/.test(part);

    if (isMath) {
      return <InlineMath key={i} math={part.replace(/\.$/, "")} />;
    }

    return <span key={i}>{part}</span>;
  });
}

export default function MathDisplay({
  text,
  className = "",
}: MathDisplayProps) {
  return (
    <p className={`leading-7 text-slate-800 ${className}`}>
      {splitMath(text)}
    </p>
  );
}