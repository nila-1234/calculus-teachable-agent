"use client";

import { useEffect } from "react";
import { logEvent } from "@/lib/logger";

/**
 * Keystroke tracking for every text answer, modelled on the Oak Lab
 * keystroke-tracker (Asher & Gold; github.com/the-oak-lab/keystroke-tracker).
 * Instead of judging what an answer says, it records how it was entered:
 *
 *   qid, keypresses (key-up events), pastes, copies, keystroke_order, text
 *
 * plus what this app needs on top: cuts and drops, how much text was pasted or
 * dropped in, characters inserted with the on-screen math keypad (which has no
 * keystrokes), and timing. One `keystroke_log` event per answer, sent when the
 * participant leaves the box or the page (latest one wins); a chat message is
 * its own answer, sent when it's submitted.
 *
 * The flags (more than one paste; more characters than keys pressed) are
 * computed in the analysis, not here — see lib/tests/ai-check.ts.
 *
 * Answers are identified by `data-qid` on the field (e.g. "pretest:1b"); a
 * field without one falls back to its page and placeholder. Nothing is logged
 * in instructor preview or tooling (logEvent drops it).
 */

const MAX_ORDER = 3000;

type Log = {
  qid: string;
  path: string;
  keypresses: number;
  pastes: number;
  copies: number;
  cuts: number;
  drops: number;
  pasted_chars: number;
  dropped_chars: number;
  keypad_chars: number;
  keystroke_order: string[];
  text: string;
  first_input_at: number | null;
  last_input_at: number | null;
  segment: number;
};

type Field = HTMLTextAreaElement | HTMLInputElement;

const isTextField = (target: EventTarget | null): target is Field => {
  if (target instanceof HTMLTextAreaElement) return true;
  return (
    target instanceof HTMLInputElement &&
    ["text", "search", "number", "email", "url", ""].includes(target.type)
  );
};

/** The study step a field belongs to, as used for scenario_id elsewhere. */
function scenarioFor(path: string): string {
  const [first, second] = path.split("/").filter(Boolean);
  if ((first === "survey" || first === "test") && second) return second;
  if (first === "lesson" && second) return `lesson-${second}`;
  return first ?? "-";
}

export default function KeystrokeTracker() {
  useEffect(() => {
    const logs = new Map<string, Log>();
    const dirty = new Set<string>();

    const qidOf = (el: Field) =>
      el.dataset.qid ||
      `${location.pathname}|${el.name || el.id || el.getAttribute("aria-label") || el.placeholder || "field"}`;

    const logFor = (el: Field): Log => {
      const qid = qidOf(el);
      let log = logs.get(qid);
      if (!log) {
        log = {
          qid,
          path: location.pathname,
          keypresses: 0,
          pastes: 0,
          copies: 0,
          cuts: 0,
          drops: 0,
          pasted_chars: 0,
          dropped_chars: 0,
          keypad_chars: 0,
          keystroke_order: [],
          text: el.value,
          first_input_at: null,
          last_input_at: null,
          segment: 0,
        };
        logs.set(qid, log);
      }
      return log;
    };

    const record = (el: Field, entry: string, patch: (log: Log) => void) => {
      const log = logFor(el);
      patch(log);
      if (log.keystroke_order.length < MAX_ORDER) log.keystroke_order.push(entry);
      const now = Date.now();
      if (log.first_input_at == null) log.first_input_at = now;
      log.last_input_at = now;
      log.text = el.value;
      dirty.add(log.qid);
    };

    const send = (log: Log) => {
      const { segment, ...data } = log;
      void logEvent("keystroke_log", scenarioFor(log.path), {
        ...data,
        // A chat box holds one answer per sent message.
        qid: segment ? `${log.qid}#${segment}` : log.qid,
        chars: log.text.length,
      });
      dirty.delete(log.qid);
    };

    const flush = (qid: string) => {
      const log = logs.get(qid);
      if (log && dirty.has(qid)) send(log);
    };
    const flushAll = () => [...dirty].forEach(flush);

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isTextField(e.target)) return;
      record(e.target, e.key, (log) => {
        log.keypresses += 1;
      });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!isTextField(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      const el = e.target;
      // The pasted text lands after this event; record once it has.
      setTimeout(() =>
        record(el, "paste", (log) => {
          log.pastes += 1;
          log.pasted_chars += text.length;
        })
      );
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!isTextField(e.target)) return;
      record(e.target, "copy", (log) => {
        log.copies += 1;
      });
    };
    const onCut = (e: ClipboardEvent) => {
      if (!isTextField(e.target)) return;
      const el = e.target;
      setTimeout(() =>
        record(el, "cut", (log) => {
          log.cuts += 1;
        })
      );
    };
    const onDrop = (e: DragEvent) => {
      if (!isTextField(e.target)) return;
      const text = e.dataTransfer?.getData("text") ?? "";
      if (!text) return;
      const el = e.target;
      setTimeout(() =>
        record(el, "drop", (log) => {
          log.drops += 1;
          log.dropped_chars += text.length;
        })
      );
    };
    const onKeypad = (e: Event) => {
      if (!isTextField(e.target)) return;
      const text = String((e as CustomEvent).detail?.text ?? "");
      const el = e.target;
      setTimeout(() =>
        record(el, `keypad:${text}`, (log) => {
          log.keypad_chars += text.length;
        })
      );
    };
    const onInput = (e: Event) => {
      if (!isTextField(e.target)) return;
      const log = logFor(e.target);
      log.text = e.target.value;
      log.last_input_at = Date.now();
      dirty.add(log.qid);
    };
    // A chat message: send it as its own answer, then start the next one.
    const onSubmitted = (e: Event) => {
      if (!isTextField(e.target)) return;
      const log = logFor(e.target);
      log.text = String((e as CustomEvent).detail?.text ?? log.text);
      send(log);
      logs.set(log.qid, {
        ...log,
        keypresses: 0,
        pastes: 0,
        copies: 0,
        cuts: 0,
        drops: 0,
        pasted_chars: 0,
        dropped_chars: 0,
        keypad_chars: 0,
        keystroke_order: [],
        text: "",
        first_input_at: null,
        last_input_at: null,
        segment: log.segment + 1,
      });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      flush(qidOf(e.target));
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flushAll();
    };

    document.addEventListener("keyup", onKeyUp, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("keypad-insert", onKeypad, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("answer-submitted", onSubmitted, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    return () => {
      flushAll();
      document.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("keypad-insert", onKeypad, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("answer-submitted", onSubmitted, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
    };
  }, []);

  return null;
}
