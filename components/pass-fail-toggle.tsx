"use client";

type PassFailToggleProps = {
  value?: "pass" | "fail" | "";
  onChange: (value: "pass" | "fail") => void;
  disabled?: boolean;
};

export default function PassFailToggle({
  value,
  onChange,
  disabled = false,
}: PassFailToggleProps) {
  const isPass = value === "pass";
  const isFail = value === "fail";

  return (
    <div className="inline-flex shrink-0 gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("pass")}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isPass
            ? "border-green-600 bg-green-50 text-green-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        Pass
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("fail")}
        className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
          isFail
            ? "border-red-600 bg-red-50 text-red-700"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300"
        }`}
      >
        Fail
      </button>
    </div>
  );
}
