"use client";

import { MATH_SYMBOLS } from "@/lib/math-symbols";

type MathPickerProps = {
  onInsert: (value: string) => void;
};

export default function MathPicker({ onInsert }: MathPickerProps) {
  return (
    <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-6 shadow-md">
      <div className="grid grid-cols-5 gap-2">
        {MATH_SYMBOLS.map((symbol) => (
          <button
            key={`${symbol.label}-${symbol.value}`}
            type="button"
            onClick={() => onInsert(symbol.value)}
            className="flex h-12 items-center justify-center rounded-xl border-2 border-red-200 bg-red-100 px-3 text-lg font-medium text-red-900 transition hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {symbol.label}
          </button>
        ))}
      </div>
    </div>
  );
}