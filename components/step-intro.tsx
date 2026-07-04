"use client";

type StepIntroProps = {
  /** Small label above the title, e.g. "Welcome". Optional. */
  eyebrow?: string;
  /** Heading text, e.g. "Step 1: Create the question". Optional. */
  title?: string;
  /** One or more narration paragraphs. */
  paragraphs: string[];
  /** Kept for API compatibility; the block looks the same either way. */
  tone?: "dark" | "light";
  className?: string;
};

export default function StepIntro({
  eyebrow,
  title,
  paragraphs,
  className = "",
}: StepIntroProps) {
  return (
    <div className={`mx-auto mb-6 w-full ${className}`}>
      {eyebrow && (
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-400">
          {eyebrow}
        </p>
      )}

      {title && (
        <h2 className="mb-1.5 text-base font-semibold text-stone-600">{title}</h2>
      )}

      <div className="space-y-2">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-6 text-stone-500">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
