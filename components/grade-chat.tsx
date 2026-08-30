"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

export type ChatMessage = {
  id: string;
  role: "student" | "ai-student" | "professor" | "user";
  text: string;
};

type GradeChatProps = {
  studentLabel: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  pending?: boolean;
  status?: "continue" | "resolved";
  onEnd?: () => void;
  emptyText?: string;
  compact?: boolean;
};

export default function GradeChat({
  studentLabel,
  messages,
  onSend,
  pending = false,
  status = "continue",
  onEnd,
  emptyText,
  compact = false,
}: GradeChatProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const resolved = status === "resolved";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending || resolved) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between gap-3 border-b border-stone-200 ${compact ? "px-3 py-2" : "px-5 py-4"}`}>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            {compact ? "Grading discussion" : "Chat"}
          </span>
          <h3 className={`${compact ? "text-sm" : "text-base"} font-bold text-stone-800`}>
            {studentLabel}
          </h3>
        </div>
        {resolved ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
            Resolved
          </span>
        ) : onEnd ? (
          <button
            type="button"
            onClick={onEnd}
            className="text-[11px] font-semibold text-stone-500 underline decoration-stone-300 underline-offset-2 hover:text-stone-700"
          >
            End discussion
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 space-y-3 overflow-y-auto ${compact ? "max-h-64 px-3 py-3" : "px-5 py-4"}`}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-stone-400">
            {emptyText ?? `Grade a criterion to start the conversation with ${studentLabel}.`}
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-lime-600 text-white"
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {message.role !== "user" ? (
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    {message.role === "professor" ? "Professor" : studentLabel}
                  </span>
                ) : null}
                <MathDisplay text={message.text} />
              </div>
            </div>
          ))
        )}
        {pending ? (
          <p className="text-xs italic text-stone-400">{studentLabel} is thinking...</p>
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
          disabled={pending || resolved}
          placeholder={resolved ? "Discussion resolved" : `Reply to ${studentLabel}...`}
          rows={1}
          className="min-h-[40px] flex-1 resize-none rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50"
        />
        <button
          type="submit"
          disabled={!draft.trim() || pending || resolved}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white transition-colors hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
        >
          <PaperPlaneIcon />
        </button>
      </form>
    </div>
  );
}
