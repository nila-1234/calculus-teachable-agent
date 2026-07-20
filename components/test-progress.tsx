"use client";

type TestProgressProps = {
  labels: string[];
  /** 0-indexed position in `labels`. */
  currentStep: number;
};

export default function TestProgress({ labels, currentStep }: TestProgressProps) {
  const columns = labels
    .map((_, index) => (index < labels.length - 1 ? "28px 1fr" : "28px"))
    .join(" ");

  return (
    <div className="mx-auto mb-6 w-full max-w-2xl select-none px-4">
      <div className="grid items-center" style={{ gridTemplateColumns: columns }}>
        {labels.map((_, index) => {
          const isCompleted = index < currentStep;

          return index < labels.length - 1 ? (
            <div
              key={`connector-${index}`}
              className={`h-0.5 transition-colors ${
                isCompleted ? "bg-lime-600" : "bg-stone-200"
              }`}
              style={{ gridRow: 1, gridColumn: index * 2 + 2 }}
            />
          ) : null;
        })}

        {labels.map((label, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div
              key={label}
              className="flex justify-center"
              style={{ gridRow: 1, gridColumn: index * 2 + 1 }}
            >
              {isCompleted ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-600 text-white font-bold">
                  {index + 1}
                </div>
              ) : isActive ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-600 text-base font-bold text-white">
                  {index + 1}
                </div>
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 text-xs font-bold text-stone-400">
                  {index + 1}
                </div>
              )}
            </div>
          );
        })}

        {labels.map((label, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div
              key={`label-${label}`}
              className="flex justify-center overflow-visible"
              style={{ gridRow: 2, gridColumn: index * 2 + 1 }}
            >
              <span
                className={`mt-2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider ${
                  isActive
                    ? "text-lime-700"
                    : isCompleted
                      ? "text-stone-600"
                      : "text-stone-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
