"use client";

import { useRef, useState } from "react";
import MathDisplay from "@/components/math-display";
import { MATH_SYMBOLS } from "@/lib/math-symbols";
import { insertAtCursor } from "@/lib/math";
import { toMathPreview } from "@/lib/tests/format";

type TestMathInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

/**
 * Textarea with live math rendering (x^2 renders as a superscript in the
 * preview) and a toggleable keypad of math symbols that insert at the cursor.
 */
export default function TestMathInput({
  value,
  onChange,
  placeholder,
  rows = 8,
}: TestMathInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const handleInsert = (symbol: string) => {
    onChange(insertAtCursor(textareaRef.current, symbol));
  };

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50"
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowKeys((prev) => !prev)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-lime-600 hover:text-lime-700 focus-visible:outline-none focus-visible:border-lime-600"
        >
          {showKeys ? "Hide math keys" : "Math keys"}
        </button>
        <span className="text-xs text-stone-400">
          Tip: type x^2 for exponents — it renders in the preview below.
        </span>
      </div>

      {showKeys && (
        <div className="rounded-xl border-2 border-stone-200 bg-white p-3">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {MATH_SYMBOLS.map((symbol) => (
              <button
                key={`${symbol.label}-${symbol.value}`}
                type="button"
                onClick={() => handleInsert(symbol.value)}
                className="flex h-10 items-center justify-center rounded-lg border-2 border-stone-200 bg-stone-50 px-2 text-base font-medium text-stone-700 transition-colors hover:border-lime-600 hover:bg-lime-50 focus-visible:outline-none focus-visible:border-lime-600"
              >
                {symbol.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.trim() && (
        <div className="rounded-xl border-2 border-stone-100 bg-stone-50 px-3 py-2">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
            Preview
          </p>
          <MathDisplay
            text={toMathPreview(value)}
            className="text-sm leading-6 text-stone-700"
          />
        </div>
      )}
    </div>
  );
}
