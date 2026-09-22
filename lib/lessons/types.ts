/** The block model a Learnvia activity is flattened into. */

export type LessonChoice = {
  id: string;
  /** Empty when the option is a diagram — see labelImage. */
  label: string;
  labelImage: string | null;
  correct: boolean;
  explanation: string;
};

export type LessonQuestion = {
  id: string;
  kind: "choice" | "short";
  prompt: string;
  promptImages: string[];
  hints: string[];
  correctExplanation: string;
  choices?: LessonChoice[];
  /** Accepted responses for a short-answer item. */
  answers?: string[];
};

export type LessonBodyItem =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "img"; src: string };

export type LessonSection =
  | {
      kind: "video";
      /** Provenance only — never rendered. */
      sourceIdentifier: string;
      durationMin: number;
      /** Narration captions, joined. The video itself is not reproducible. */
      transcript: string;
      questions: LessonQuestion[];
    }
  | {
      kind: "text" | "practice";
      body: LessonBodyItem[];
      questions: LessonQuestion[];
    };

export type LessonDefinition = {
  /** Neutral slug. The unit it came from is sourceUnit, and stays unshown. */
  id: string;
  sourceUnit: string;
  title: string;
  durationMin: number;
  sections: LessonSection[];
};
