"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { logEvent } from "@/lib/logger";
import { isPreviewActive } from "@/lib/preview";

/**
 * Pages of the instruction (both arms) where pasting is turned off, so
 * participants can't paste AI-written answers into the activity. Screening
 * deliberately allows pasting — see AI_CHECK_ITEM in lib/surveys/eligibility.ts
 * — so that anyone who pastes an answer is screened out before this point.
 */
const INSTRUCTION_PATHS = [
  /^\/\d+\/(question|create-rubric|grade-lines)(\/|$)/,
  /^\/lesson(\/|$)/,
];

const isTextField = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    ["text", "search", "number", "email", "url", ""].includes(target.type)
  );
};

/**
 * Blocks pasting and dropping text into any text box on the instruction pages,
 * shows a short note explaining why, and logs each attempt (`paste_blocked`).
 * Instructor preview is left alone.
 */
export default function PasteGuard() {
  const pathname = usePathname();
  const [notice, setNotice] = useState(false);
  const active = INSTRUCTION_PATHS.some((p) => p.test(pathname ?? ""));

  useEffect(() => {
    if (!active || isPreviewActive()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const block = (kind: "paste" | "drop") => (event: Event) => {
      if (!isTextField(event.target)) return;
      const text =
        kind === "paste"
          ? (event as ClipboardEvent).clipboardData?.getData("text") ?? ""
          : (event as DragEvent).dataTransfer?.getData("text") ?? "";
      if (kind === "drop" && !text) return; // not a text drop (e.g. a rubric chip)
      event.preventDefault();
      void logEvent("paste_blocked", pathname?.split("/")[1] ?? "-", {
        kind,
        path: pathname,
        chars: text.length,
      });
      setNotice(true);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(false), 4000);
    };

    const onPaste = block("paste");
    const onDrop = block("drop");
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("drop", onDrop, true);
    };
  }, [active, pathname]);

  if (!active || !notice) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-lg"
    >
      Pasting is turned off in this activity — please type your answer.
    </div>
  );
}
