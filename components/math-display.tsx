"use client";

import { InlineMath } from "react-katex";

type MathDisplayProps = {
  text: string;
  className?: string;
};

function splitMath(text: string) {
  // Split on \( ... \)
  const regex = /(\\\(.*?\\\))/g;

  const parts = text.split(regex).filter(Boolean);

  return parts.map((part, i) => {
    const isMath = part.startsWith("\\(") && part.endsWith("\\)");

    if (isMath) {
      const math = part.slice(2, -2); // remove \( \)
      return <InlineMath key={i} math={math} />;
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