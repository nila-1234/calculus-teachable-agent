"use client";

type TwoStateToggleProps<T extends string> = {
  value?: T | "";
  onChange: (value: T) => void;
  disabled?: boolean;
  positive: { value: T; label: string };
  negative: { value: T; label: string };
};

export default function TwoStateToggle<T extends string>({
  value,
  onChange,
  disabled = false,
  positive,
  negative,
}: TwoStateToggleProps<T>) {
  const isPositive = value === positive.value;
  const isNegative = value === negative.value;

  return (
    <div className="inline-flex shrink-0 gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(positive.value)}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isPositive
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        {positive.label}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(negative.value)}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isNegative
            ? "border-red-600 bg-red-50 text-red-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        {negative.label}
      </button>
    </div>
  );
}
