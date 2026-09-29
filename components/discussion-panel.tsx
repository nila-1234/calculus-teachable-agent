"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircledIcon, Cross1Icon, PaperPlaneIcon, UpdateIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

export type DiscussionMessage = {
  id: string;
  role: "user" | "student" | "professor";
  text: string;
};

// Quick replies the TA can send with one click instead of typing, covering the three
// natural responses to a challenge or correction: hold your ground, back down, or concede.
const QUICK_REPLIES = ["Yes, I'm sure", "No, let me look again", "Oh, you're right"];

type DiscussionPanelProps = {
  open: boolean;
  onClose: () => void;
  counterpartLabel: string;
  criterionLabel: string;
  // Shown as the first bubble. Omitted when the whole thread, opener included, is in
  // `messages` (the placement discussion).
  openingComment?: string;
  messages: DiscussionMessage[];
  pending: boolean;
  // True once the counterpart has conceded the point — shows a closing note instead of
  // implying there's still something to settle.
  resolved?: boolean;
  resolvedNote?: string;
  onSend: (text: string) => void;
  // When true, the panel can't be dismissed until the TA has sent at least one reply —
  // used so a challenge or correction can't just be closed away unanswered.
  forceReply?: boolean;
  // Overrides the close rule above when given — the placement discussion stays open
  // exactly as long as the item is locked waiting on an answer.
  closable?: boolean;
  // One-click replies. When given, shown as-is (an empty list hides them); when omitted,
  // the defaults show until the TA's first reply.
  quickReplies?: string[];
  // When set, typing is disabled and this explains why (e.g. "Close this and drag again").
  inputDisabledReason?: string;
};

export default function DiscussionPanel({
  open,
  onClose,
  counterpartLabel,
  criterionLabel,
  openingComment,
  messages,
  pending,
  resolved = false,
  resolvedNote = "This conversation is resolved. You can proceed to the next step.",
  onSend,
  forceReply = false,
  closable,
  quickReplies,
  inputDisabledReason,
}: DiscussionPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasReplied = messages.some((message) => message.role === "user");
  const canClose = closable ?? (!forceReply || hasReplied);
  const shownQuickReplies = quickReplies ?? (hasReplied ? [] : QUICK_REPLIES);
  const inputDisabled = pending || inputDisabledReason != null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || inputDisabled) return;
    onSend(text);
    setDraft("");
  };

  const handleQuickReply = (text: string) => {
    if (inputDisabled) return;
    onSend(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-900/30"
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
              Discussion
            </span>
            <h3 className="text-base font-bold text-stone-800">{counterpartLabel}</h3>
            <div className="mt-0.5 text-xs text-stone-500">
              <MathDisplay text={criterionLabel} className="inline text-xs text-stone-500" />
            </div>
          </div>
          <button
            type="button"
            onClick={canClose ? onClose : undefined}
            disabled={!canClose}
            aria-label={canClose ? "Close discussion" : "Reply before closing this discussion"}
            title={canClose ? undefined : "Reply before closing this discussion"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Cross1Icon width={16} height={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {openingComment ? (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-xl rounded-tl-none bg-sky-50 px-3.5 py-2.5 text-sm leading-6 text-sky-900">
                <MathDisplay text={openingComment} />
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-tr-none bg-lime-600 text-white"
                    : "rounded-tl-none bg-sky-50 text-sky-900"
                }`}
              >
                <MathDisplay text={message.text} />
              </div>
            </div>
          ))}

          {pending ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-xl rounded-tl-none bg-sky-50 px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-sky-500">
                <UpdateIcon className="shrink-0 animate-spin" />
                Checking...
              </div>
            </div>
          ) : null}

          {resolved && !pending ? (
            <div className="flex items-center gap-1.5 px-1 pt-1 text-xs font-medium text-green-700">
              <CheckCircledIcon className="shrink-0" />
              {resolvedNote}
            </div>
          ) : null}
        </div>

        {shownQuickReplies.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-stone-200 px-3 pt-3">
            {shownQuickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                disabled={inputDisabled}
                onClick={() => handleQuickReply(reply)}
                className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-600 transition-colors hover:border-lime-600 hover:text-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className={`flex items-end gap-2 p-3 ${shownQuickReplies.length > 0 ? "" : "border-t border-stone-200"}`}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={inputDisabledReason ?? `Reply to ${counterpartLabel}...`}
            rows={1}
            disabled={inputDisabled}
            className="min-h-[40px] flex-1 resize-none rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || inputDisabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white transition-colors hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            <PaperPlaneIcon />
          </button>
        </form>
        <p className="px-3 pb-2 text-[11px] leading-4 text-stone-400">
          AI-generated replies may be incorrect. If the conversation goes off track, refresh
          the page to restart.
        </p>
      </div>
    </div>
  );
}
