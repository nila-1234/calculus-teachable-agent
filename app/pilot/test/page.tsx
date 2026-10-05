"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import PilotTestRunner from "@/components/pilot/test-runner";
import { getPilotTest, type PilotForm } from "@/lib/pilot/tests";
import { previewForm, resolvePilotForm } from "@/lib/pilot/condition";
import { isPreviewActive } from "@/lib/preview";
import { logEvent } from "@/lib/logger";

/**
 * The test step: resolve the participant's balanced A/B form (A = pretest,
 * B = posttest) and run it. Preview honours ?form=A|B and never consumes an
 * assignment.
 */
function PilotTest() {
  const router = useRouter();
  const query = useSearchParams().toString();
  const [form, setForm] = useState<PilotForm | null>(null);

  useEffect(() => {
    let cancelled = false;

    const decide = async () =>
      isPreviewActive() ? previewForm() : resolvePilotForm();

    void decide().then((resolved) => {
      if (cancelled) return;
      if (!isPreviewActive()) {
        logEvent("pilot_form_assigned", "pilot", { form: resolved });
      }
      setForm(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-stone-400">Loading…</p>
      </div>
    </main>
  );

  if (!form) return loading;
  const test = getPilotTest(form);
  if (!test) return loading;

  return (
    <PilotTestRunner
      test={test}
      onComplete={() =>
        router.push(
          query
            ? `/pilot/survey/difficulty?${query}`
            : "/pilot/survey/difficulty"
        )
      }
    />
  );
}

export default function PilotTestPage() {
  return (
    <Suspense>
      <PilotTest />
    </Suspense>
  );
}
