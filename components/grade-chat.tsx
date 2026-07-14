"use client";

import { useEffect, useRef, useState } from "react";
import { PaperPlaneIcon } from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";

export type ChatMessage = {
  id: string;
  role: "student" | "user";
  text: string;
};

type GradeChatProps = {
  studentLabel: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

export default function GradeChat({ studentLabel, messages, onSend }: GradeChatProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-4">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Chat</span>
        <h3 className="text-base font-bold text-stone-800">{studentLabel}</h3>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-stone-400">
            Grade a criterion to start the conversation with {studentLabel}.
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
                <MathDisplay text={message.text} />
              </div>
            </div>
          ))
        )}
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
          className="min-h-[40px] flex-1 resize-none rounded-lg border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 transition-colors focus:outline-none focus:border-lime-600 focus:ring-4 focus:ring-lime-50"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime-600 text-white transition-colors hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400"
        >
          <PaperPlaneIcon />
        </button>
      </form>
    </div>
  );
}
