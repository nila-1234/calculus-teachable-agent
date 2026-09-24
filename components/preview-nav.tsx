"use client";

import { Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  PREVIEW_PARAM,
  previewHref,
  previewStops,
  scenarioIdFromPath,
  stopIndexForPath,
} from "@/lib/preview";
import { STUDY_SCENARIO_ID } from "@/lib/scenarios/utils";

/**
 * Minimal phase stepper, shown only while ?preview is in the URL.
 *
 * Deliberately unlabelled: the instructor arrives from a dedicated link, so a
 * banner explaining what preview mode is would only be noise. Stepping within a
 * phase is handled by the page itself; this moves between phases.
 */
function PreviewNavContent() {
  const pathname = usePathname();
  const router = useRouter();
  const active = useSearchParams().has(PREVIEW_PARAM);

  if (!active || !pathname) return null;

  // Stay on whichever scenario the instructor is actually looking at.
  const scenarioId = scenarioIdFromPath(pathname) ?? STUDY_SCENARIO_ID;
  const stops = previewStops(scenarioId);
  const index = stopIndexForPath(pathname, scenarioId);

  const prev = index > 0 ? stops[index - 1] : null;
  const next = index > -1 && index < stops.length - 1 ? stops[index + 1] : null;

  return (
    <div className="sticky bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3">
        <a
          href="/instructor"
          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
        >
          ← Instructor
        </a>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && router.push(previewHref(prev.path))}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {prev ? `← ${prev.label}` : "← Previous"}
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && router.push(previewHref(next.path))}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {next ? `${next.label} →` : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary because this renders from the root
 * layout, which is otherwise statically rendered.
 */
export default function PreviewNav() {
  return (
    <Suspense fallback={null}>
      <PreviewNavContent />
    </Suspense>
  );
}
