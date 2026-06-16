"use client";

import { CheckIcon } from "@radix-ui/react-icons";

const STEPS = [
  "Question",
  "Create Rubric",
  "Apply Rubric",
  "Complete",
];

type StepProgressProps = {
  currentStep: number; // 0-indexed: 0=question, 1=create-rubric, 2=apply-rubric, 3=complete
};

const SLOT = "w-24";
const LINE = "w-16";

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="flex flex-col items-center mb-4 px-4 select-none">

      {/* Row 1: labels */}
      <div className="flex items-end mb-2">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center">
            <div className={`${SLOT} flex justify-center`}>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider text-center leading-tight transition-colors ${
                  index <= currentStep ? "text-white" : "text-white/40"
                }`}
              >
                {label}
              </span>
            </div>
            {index < STEPS.length - 1 && <div className={LINE} />}
          </div>
        ))}
      </div>

      {/* Row 2: circles + lines */}
      <div className="flex items-center">
        {STEPS.map((label, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;

          return (
            <div key={label} className="flex items-center">
              <div className={`${SLOT} flex justify-center`}>
                {isCompleted ? (
                  <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
                    <CheckIcon className="text-lime-700" width={16} height={16} />
                  </div>
                ) : isActive ? (
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-transparent shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-white/30 shrink-0" />
                )}
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 ${LINE} shrink-0 transition-colors ${
                    index < currentStep ? "bg-white" : "bg-white/25"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
