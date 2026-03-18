"use client";

import { useRef, useState } from "react";
import MathPicker from "./math-picker";
import MathDisplay from "./math-display";
import { insertAtCursor } from "@/lib/math";

type MathInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function MathInput({
  label,
  value,
  onChange,
  placeholder = "Write here...",
}: MathInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleInsert = (symbol: string) => {
    const rawInsertedValue = insertAtCursor(textareaRef.current, symbol);
    onChange(rawInsertedValue);
  };

  return (
    <div className="mt-2">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-900">{label}</label>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] w-full rounded-2xl bg-red-50 p-4 text-base text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200"
      />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowPicker((prev) => !prev)}
          className="rounded-xl bg-red-300 px-4 py-2 mb-2 text-sm font-medium text-white transition hover:bg-red-400"
        >
          {showPicker ? "Hide Math Options" : "Math Options"}
        </button>
      </div>

      {showPicker && (
        <div className="">
          <MathPicker onInsert={handleInsert} />
        </div>
      )}

      <p className="my-2 text-sm font-semibold text-slate-900">Preview</p>
      <div className="mt-4 rounded-2xl bg-gray-50 p-4">
        <div className="min-h-[48px] text-slate-500 text-sm">
          {value.trim() ? (
            <MathDisplay text={value} />
          ) : (
            <p className="text-slate-500 text-sm">Preview will appear here...</p>
          )}
        </div>
      </div>
    </div>
  );
}