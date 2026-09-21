"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import {
  CONSENT_AGREEMENTS,
  CONSENT_INTRO,
  CONSENT_SECTIONS,
  CONSENT_TITLE,
} from "@/lib/surveys/consent";
import { logEvent } from "@/lib/logger";
import { PREVIEW_PARAM } from "@/lib/preview";
import { isScreenedOut } from "@/lib/surveys/eligibility";
import { getSubjectId } from "@/lib/subject";
import { getProlificPid } from "@/lib/prolific";

type Answer = "yes" | "no" | null;

function ConsentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const preview = searchParams.has(PREVIEW_PARAM);

  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [fullName, setFullName] = useState("");

  // Defence in depth: the screening page already redirects, but consent is the
  // gate to the study proper and must not be reachable by URL after exclusion.
  useEffect(() => {
    if (preview) return;
    if (isScreenedOut()) {
      router.replace(query ? `/not-eligible?${query}` : "/not-eligible");
    }
  }, [preview, query, router]);

  const allAffirmed = CONSENT_AGREEMENTS.every(
    (item) => answers[item.id] === "yes"
  );
  const declined = CONSENT_AGREEMENTS.some((item) => answers[item.id] === "no");
  const canContinue = (allAffirmed && fullName.trim().length > 0) || preview;

  const handleContinue = () => {
    if (!canContinue) return;

    if (!preview) {
      sessionStorage.setItem("consent:given", "true");

      // The name goes to /api/consent, which writes a separate `consents`
      // collection. It is deliberately NOT in this event: the consent text says
      // data and consent form are kept separate, and every analysis reads the
      // log. Failing to record it must not block a participant, so this is
      // fire-and-forget — the console carries the error.
      void fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: getSubjectId(),
          name: fullName.trim(),
          agreements: CONSENT_AGREEMENTS.map((item) => item.id),
          prolific_pid: getProlificPid(),
        }),
      }).catch((err) => console.error("Could not record consent:", err));
    }

    logEvent("consent_given", "consent", {
      agreements: CONSENT_AGREEMENTS.map((item) => item.id),
      name_provided: fullName.trim().length > 0,
    });

    router.push(query ? `/survey/pre?${query}` : "/survey/pre");
  };

  return (
    <main className="min-h-screen bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Consent
        </p>
        <h1 className="mt-2 text-2xl font-bold text-stone-800">
          {CONSENT_TITLE}
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{CONSENT_INTRO}</p>

        <div className="mt-6 max-h-[28rem] overflow-y-auto rounded-xl border-2 border-stone-200 bg-white p-6 shadow-sm">
          {CONSENT_SECTIONS.map((section) => (
            <section key={section.heading} className="mb-6 last:mb-0">
              <h2 className="text-sm font-bold text-stone-800">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {CONSENT_AGREEMENTS.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-stone-200 bg-white p-4"
            >
              <span className="text-sm text-stone-700">{item.text}</span>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((option) => {
                  const selected = answers[item.id] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [item.id]: option }))
                      }
                      className={`rounded-lg border-2 px-4 py-1.5 text-sm font-bold capitalize transition-colors ${
                        selected
                          ? "border-lime-600 bg-lime-600 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <label className="mt-6 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Full name
          </span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            className="h-11 w-full max-w-md rounded-xl border-2 border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-lime-600 focus:outline-none"
          />
        </label>

        {declined && (
          <p className="mt-6 rounded-xl border-2 border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
            You must agree to all three statements to take part. If you do not
            wish to participate, you may close this page — no further action is
            required.
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button onClick={handleContinue} disabled={!canContinue}>
            Agree and continue
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentPageContent />
    </Suspense>
  );
}
