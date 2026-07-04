"use client";

import { EyeOpenIcon } from "@radix-ui/react-icons";

type HintButtonProps = {
  onClick: () => void;
  label?: string;
};

export default function HintButton({
  onClick,
  label = "View correct answer",
}: HintButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border-2 border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700"
    >
      <EyeOpenIcon width={14} height={14} />
      {label}
    </button>
  );
}
