"use client";

import { useEffect, useRef, useState } from "react";
import { Cross1Icon, PaperPlaneIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

export type DiscussionMessage = {
  id: string;
  role: "user" | "student";
  text: string;
};

type DiscussionPanelProps = {
  open: boolean;
  onClose: () => void;
  studentLabel: string;
  criterionLabel: string;
  openingComment: string;
  messages: DiscussionMessage[];
  pending: boolean;
  onSend: (text: string) => void;
};

export default function DiscussionPanel({
  open,
  onClose,
  studentLabel,
  criterionLabel,
  openingComment,
  messages,
  pending,
  onSend,
}: DiscussionPanelProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-sm flex-col border-l border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
              Discussion
            </span>
            <h3 className="text-base font-bold text-stone-800">{studentLabel}</h3>
            <div className="mt-0.5 text-xs text-stone-500">
              <MathDisplay text={criterionLabel} className="inline text-xs text-stone-500" />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close discussion"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <Cross1Icon width={16} height={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl rounded-tl-none bg-sky-50 px-3.5 py-2.5 text-sm leading-6 text-sky-900">
              <MathDisplay text={openingComment} />
            </div>
          </div>

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
              <div className="max-w-[85%] rounded-xl rounded-tl-none bg-sky-50 px-3.5 py-2.5 text-sm italic text-sky-700">
                {studentLabel} is thinking...
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-stone-200 p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={`Reply to ${studentLabel}...`}
            rows={1}
            disabled={pending}
            className="min-h-[40px] flex-1 resize-none rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50 disabled:bg-stone-50 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white transition-colors hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
          >
            <PaperPlaneIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
