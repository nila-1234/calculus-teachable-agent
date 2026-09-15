"use client";

import { useState } from "react";

/**
 * The code a participant pastes back into Prolific.
 *
 * Shown large and copyable because getting it wrong costs the participant their
 * payment. If no code is configured the component says so plainly rather than
 * rendering an empty box — a blank space here would look like the study simply
 * ended, and the participant would never know they were owed a code.
 */
export default function CompletionCode({
  code,
  label = "Your completion code",
  envVar,
  fallback,
}: {
  code: string | null;
  label?: string;
  envVar: string;
  /**
   * What to show when no code is configured *by design* — a screened-out
   * participant with no screen-out code needs instructions, not a config error.
   */
  fallback?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  if (!code && fallback) return <>{fallback}</>;

  if (!code) {
    return (
      <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left">
        <p className="text-sm font-bold text-amber-900">
          No completion code is configured.
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          Please contact the researcher — your participation has been recorded,
          but the code needed for payment is missing. (Set{" "}
          <code className="font-mono">{envVar}</code> in the deployment.)
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border-2 border-stone-200 bg-stone-50 p-5 text-left">
      <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
        {label}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="select-all rounded-lg border-2 border-stone-300 bg-white px-4 py-2 font-mono text-lg font-bold tracking-wide text-stone-800">
          {code}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked; the code is select-all so it can
              // still be copied by hand.
              setCopied(false);
            }
          }}
          className="rounded-xl border-2 border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:border-lime-600"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-stone-600">
        Copy this code and paste it into Prolific to complete your submission.
        Your payment depends on it, so please do this before closing the page.
      </p>
    </div>
  );
}
