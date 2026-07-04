"use client";

import { Cross1Icon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import Button from "@/components/button";

type SampleAnswerModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  eyebrow?: string;
  description?: string;
};

export default function SampleAnswerModal({
  open,
  onClose,
  title,
  text,
  eyebrow = "Fully correct answer",
  description,
}: SampleAnswerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-stone-200 bg-stone-100 p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-600"
          >
            <Cross1Icon width={16} height={16} />
          </button>

          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-stone-400">
            {eyebrow}
          </span>
          <h3 className="pr-8 text-lg font-bold text-stone-800">{title}</h3>
          {description && <p className="mt-1 pr-8 text-sm text-stone-500">{description}</p>}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
            <MathDisplay text={text} />
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
