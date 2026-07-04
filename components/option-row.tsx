"use client";

import { CheckIcon, Cross2Icon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

export type OptionRowState = "default" | "selected" | "correct" | "incorrect" | "dimmed";

type OptionRowProps = {
  index: number;
  text: string;
  state: OptionRowState;
  disabled?: boolean;
  onClick?: () => void;
};

const BADGE_STYLES: Record<OptionRowState, string> = {
  default: "border-stone-300 text-stone-500",
  selected: "border-lime-600 bg-lime-600 text-white",
  correct: "border-green-600 bg-green-600 text-white",
  incorrect: "border-red-600 bg-red-600 text-white",
  dimmed: "border-stone-200 text-stone-300",
};

const ROW_STYLES: Record<OptionRowState, string> = {
  default: "border-stone-200 bg-white hover:border-stone-300",
  selected: "border-lime-600 bg-lime-50",
  correct: "border-green-600 bg-green-50",
  incorrect: "border-red-600 bg-red-50",
  dimmed: "border-stone-100 bg-stone-50 opacity-60",
};

export default function OptionRow({
  index,
  text,
  state,
  disabled = false,
  onClick,
}: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full min-h-11 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${ROW_STYLES[state]} ${
        disabled ? "cursor-default" : "cursor-pointer"
      } focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-100 focus-visible:border-lime-600`}
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${BADGE_STYLES[state]}`}
      >
        {state === "correct" ? (
          <CheckIcon width={14} height={14} />
        ) : state === "incorrect" ? (
          <Cross2Icon width={14} height={14} />
        ) : (
          index + 1
        )}
      </div>

      <div className="min-w-0 flex-1 text-stone-800">
        <MathDisplay text={text} />
      </div>

      {state === "correct" && (
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-green-600">
          Correct
        </span>
      )}
      {state === "incorrect" && (
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-red-600">
          Incorrect
        </span>
      )}
    </button>
  );
}
