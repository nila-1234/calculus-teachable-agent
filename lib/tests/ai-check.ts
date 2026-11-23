import type { LogDoc } from "./report";

/**
 * AI-use check, following the Oak Lab keystroke-tracker method
 * (github.com/the-oak-lab/keystroke-tracker, flagging_cheaters.R):
 *
 *  1. Logging — every text answer's keystroke_log (components/keystroke-tracker).
 *  2. Flagging — an answer is flagged if there was MORE THAN ONE paste event,
 *     or the final answer has MORE CHARACTERS THAN KEYS PRESSED. Characters
 *     entered with the on-screen math keypad count as typed here, since the
 *     keypad has no keystrokes and would otherwise flag every keypad user.
 *  3. Manual review — flagged answers are listed (and exported as
 *     possible_cheaters.csv) with per-person counts n_with_pastes and
 *     n_too_short. A flag is a prompt to look, not a verdict.
 */

export type KeystrokeAnswer = {
  subjectId: string;
  qid: string;
  step: string;
  keypresses: number;
  keypadChars: number;
  pastes: number;
  copies: number;
  pastedChars: number;
  chars: number;
  text: string;
  at: string;
  flagPaste: boolean;
  flagTooShort: boolean;
};

export type KeystrokePerson = {
  subjectId: string;
  answers: number;
  nWithPastes: number;
  nTooShort: number;
  /** Any paste at all, even a single one (not a flag on its own). */
  anyPaste: number;
  flagged: boolean;
};

export type AiCheck = {
  people: KeystrokePerson[];
  /** Flagged answers, for manual review. */
  flagged: KeystrokeAnswer[];
  /** How many answers had a keystroke log at all (0 for older runs). */
  logged: number;
};

const MAX_TEXT = 1500;

/**
 * Every logged answer with its keystroke counts and flags (latest log per
 * participant and answer). buildAiCheck keeps only the flagged ones; the
 * answers export needs them all.
 */
export function keystrokeAnswers(docs: LogDoc[]): KeystrokeAnswer[] {
  // Latest log per participant and answer (a log is re-sent as typing goes on).
  const latest = new Map<string, LogDoc>();
  for (const d of docs) {
    if (d.event !== "keystroke_log" || !d.subject_id) continue;
    const qid = String(d.data?.qid ?? "");
    if (!qid) continue;
    const key = `${d.subject_id}::${qid}`;
    const prev = latest.get(key);
    if (!prev || (d.timestamp ?? "") >= (prev.timestamp ?? "")) latest.set(key, d);
  }

  // A box left empty (e.g. a chat box after its message was sent) is not an answer.
  const nonEmpty = [...latest.values()].filter((d) => String(d.data?.text ?? "").trim());

  const answers: KeystrokeAnswer[] = nonEmpty.map((d) => {
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const text = String(d.data?.text ?? "");
    const keypresses = n(d.data?.keypresses);
    const keypadChars = n(d.data?.keypad_chars);
    const pastes = n(d.data?.pastes);
    return {
      subjectId: d.subject_id!,
      qid: String(d.data?.qid),
      step: d.scenario_id ?? "",
      keypresses,
      keypadChars,
      pastes,
      copies: n(d.data?.copies),
      pastedChars: n(d.data?.pasted_chars) + n(d.data?.dropped_chars),
      chars: text.length,
      text: text.slice(0, MAX_TEXT),
      at: d.timestamp ?? "",
      flagPaste: pastes > 1,
      flagTooShort: text.length > keypresses + keypadChars,
    };
  });

  return answers;
}

export function buildAiCheck(docs: LogDoc[]): AiCheck {
  const answers = keystrokeAnswers(docs);
  const bySubject = new Map<string, KeystrokeAnswer[]>();
  for (const a of answers) {
    bySubject.set(a.subjectId, [...(bySubject.get(a.subjectId) ?? []), a]);
  }

  const people: KeystrokePerson[] = [...bySubject.entries()]
    .map(([subjectId, list]) => {
      const nWithPastes = list.filter((a) => a.flagPaste).length;
      const nTooShort = list.filter((a) => a.flagTooShort).length;
      return {
        subjectId,
        answers: list.length,
        nWithPastes,
        nTooShort,
        anyPaste: list.filter((a) => a.pastes > 0).length,
        flagged: nWithPastes + nTooShort > 0,
      };
    })
    .sort(
      (a, b) =>
        Number(b.flagged) - Number(a.flagged) ||
        b.nWithPastes + b.nTooShort - (a.nWithPastes + a.nTooShort) ||
        a.subjectId.localeCompare(b.subjectId)
    );

  return {
    people,
    flagged: answers
      .filter((a) => a.flagPaste || a.flagTooShort)
      .sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.at.localeCompare(b.at)),
    logged: answers.length,
  };
}
