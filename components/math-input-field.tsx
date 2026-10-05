"use client";

import { useRef } from "react";
import { InlineMath } from "react-katex";

/**
 * A free-response input with an on-screen math keypad and a live preview.
 *
 * Piloting found equations hard to type on a keyboard. The keypad inserts
 * common symbols at the cursor, and the preview renders each line that looks
 * like an expression so a participant can check their notation. Answers are
 * still plain text (the grader reads them as text), so the keypad inserts
 * readable tokens — "^2", "sqrt()", "/" — rather than LaTeX.
 */

type Key = { label: string; insert: string; back?: number };

const KEYS: Key[] = [
  { label: "x²", insert: "^2" },
  { label: "xⁿ", insert: "^" },
  { label: "√", insert: "sqrt()", back: 1 },
  { label: "a/b", insert: "/" },
  { label: "( )", insert: "()", back: 1 },
  { label: "π", insert: "pi" },
  { label: "·", insert: "*" },
  { label: "≤", insert: "<=" },
  { label: "≥", insert: ">=" },
  { label: "′", insert: "'" },
  { label: "→", insert: "->" },
];

const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50";

/** Readable tokens -> KaTeX, for the preview only. */
function toLatex(line: string): string {
  return line
    .replace(/sqrt\(([^)]*)\)/g, "\\sqrt{$1}")
    .replace(/\bpi\b/g, "\\pi")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/->/g, "\\to ")
    .replace(/\*/g, "\\cdot ")
    // Wrap multi-character exponents so x^10 is not read as x^1 then 0.
    .replace(/\^(\{[^}]+\}|[A-Za-z0-9]+)/g, (_, g: string) =>
      g.startsWith("{") ? `^${g}` : `^{${g}}`
    );
}

/**
 * Whether to render a line as math. Prose would be mangled in math mode (KaTeX
 * collapses spaces), so a line is only rendered when it reads like an
 * expression — a math signal and at most one long word.
 */
function looksLikeMath(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const hasSignal = /[=^]|sqrt\(|\/|\d\s*[-+*/]\s*\w/.test(t);
  const longWords = (t.match(/[A-Za-z]{4,}/g) || []).length;
  return hasSignal && longWords <= 1;
}

export default function MathInputField({
  value,
  onChange,
  placeholder,
  rows = 10,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const insert = (key: Key) => {
    const el = ref.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const next = value.slice(0, start) + key.insert + value.slice(end);
    onChange(next);
    // Put the cursor inside the inserted token (e.g. between sqrt( )).
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + key.insert.length - (key.back ?? 0);
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const lines = value.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => insert(k)}
            className="rounded-lg border-2 border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:border-lime-600"
          >
            {k.label}
          </button>
        ))}
      </div>

      <textarea
        ref={ref}
        placeholder={placeholder || "Type your answer…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={TEXTAREA_CLASS}
      />

      <p className="text-xs leading-5 text-stone-400">
        Tip: type <code className="font-mono">^</code> for powers (e.g. x^2),{" "}
        <code className="font-mono">sqrt( )</code> for roots, and{" "}
        <code className="font-mono">/</code> for fractions. The buttons insert
        symbols for you.
      </p>

      {lines.length > 0 && (
        <div className="rounded-xl border-2 border-stone-100 bg-stone-50 p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Preview
          </p>
          <div className="space-y-1 text-sm leading-6 text-stone-800">
            {lines.map((line, i) =>
              looksLikeMath(line) ? (
                <div key={i} className="overflow-x-auto">
                  <InlineMath
                    math={toLatex(line)}
                    renderError={() => (
                      <span className="text-stone-600">{line}</span>
                    )}
                  />
                </div>
              ) : (
                <div key={i} className="text-stone-600">
                  {line}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
