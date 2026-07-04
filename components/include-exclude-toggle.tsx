"use client";

type IncludeExcludeToggleProps = {
  value?: "include" | "exclude";
  onChange: (value: "include" | "exclude") => void;
  disabled?: boolean;
  includeLabel?: string;
  excludeLabel?: string;
};

export default function IncludeExcludeToggle({
  value,
  onChange,
  disabled = false,
  includeLabel = "Include",
  excludeLabel = "Exclude",
}: IncludeExcludeToggleProps) {
  const isInclude = value === "include";
  const isExclude = value === "exclude";

  return (
    <div className="inline-flex shrink-0 gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("include")}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isInclude
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        {includeLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("exclude")}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isExclude
            ? "border-red-600 bg-red-50 text-red-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        {excludeLabel}
      </button>
    </div>
  );
}
