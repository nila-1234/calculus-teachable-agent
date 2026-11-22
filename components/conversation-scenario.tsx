"use client";

import MathDisplay from "@/components/math-display";

/**
 * Renders a scenario whose text includes a Student/AI conversation, with each
 * turn in its own colour.
 *
 * Piloting found Q3's wall of conversation text high in cognitive load, so the
 * speakers are visually separated — the student in one colour, the AI in
 * another. Scenarios without a conversation fall back to plain rendering, so
 * this is safe to use for every scenario.
 */

type Turn = { speaker: "Student" | "AI"; text: string };

function parse(text: string): { preamble: string; turns: Turn[] } {
  const idx = text.search(/(^|\n)\s*(Student|AI):/);
  if (idx < 0) return { preamble: text, turns: [] };

  const preamble = text.slice(0, idx).trim();
  const convo = text.slice(idx);
  const turns: Turn[] = [];

  const re = /(Student|AI):\s*([\s\S]*?)(?=\n\s*(?:Student|AI):|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(convo)) !== null) {
    turns.push({ speaker: m[1] as Turn["speaker"], text: m[2].trim() });
  }

  return { preamble, turns };
}

export default function ConversationScenario({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { preamble, turns } = parse(text);

  if (turns.length === 0) {
    return <MathDisplay text={text} className={className} />;
  }

  return (
    <div className="space-y-3">
      {preamble && <MathDisplay text={preamble} className={className} />}

      <div className="space-y-2">
        {turns.map((turn, i) => {
          const isStudent = turn.speaker === "Student";
          return (
            <div
              key={i}
              className={`rounded-xl border-2 p-3 ${
                isStudent
                  ? "border-sky-200 bg-sky-50"
                  : "border-violet-200 bg-violet-50"
              }`}
            >
              <p
                className={`mb-1 text-xs font-bold uppercase tracking-wide ${
                  isStudent ? "text-sky-700" : "text-violet-700"
                }`}
              >
                {isStudent ? "Student" : "AI"}
              </p>
              <MathDisplay
                text={turn.text}
                className="text-sm leading-6 text-stone-700"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
