"use client";

import { EyeOpenIcon } from "@radix-ui/react-icons";

type HintButtonProps = {
  onClick: () => void;
  label?: string;
};

export default function HintButton({
  onClick,
  label = "Show hint",
}: HintButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-stone-100
      px-3 py-2 text-sm font-semibold text-stone-500 transition-colors
      hover:bg-stone-200 hover:text-stone-700"
    >
      <EyeOpenIcon className="text-lime-600" width={20} height={20} />
      {label}
    </button>
  );
}
