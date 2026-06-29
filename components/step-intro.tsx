"use client";

type StepIntroProps = {
  /** Small label above the title, e.g. "Welcome". Optional. */
  eyebrow?: string;
  /** Heading text, e.g. "Step 1: Create the question". Optional. */
  title?: string;
  /** One or more narration paragraphs. */
  paragraphs: string[];
  /** Kept for API compatibility; the box looks the same on either background. */
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
    <div
      className={`mx-auto mb-6 w-full rounded-xl bg-white px-6 py-5 shadow-sm ${className}`}
    >
      {eyebrow && (
        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-lime-700">
          {eyebrow}
        </p>
      )}

      {title && (
        <h2 className="mb-2 text-xl font-bold text-black">{title}</h2>
      )}

      <div className="space-y-2">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-6 text-black">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
