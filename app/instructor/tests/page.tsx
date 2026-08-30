import AppHeader from "@/components/app-header";
import SurveyReviewPanel from "@/components/instructor/survey-review-panel";
import TestReviewPanel from "@/components/instructor/test-review-panel";
import { listSurveys } from "@/lib/surveys/definitions";
import { getTest } from "@/lib/tests/definitions";

export default function InstructorTestsPage() {
  const tests = [getTest("pretest"), getTest("posttest")].filter(
    (test) => test !== null
  );
  const surveys = listSurveys();

  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
          Instructor workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-800">
          Pre/Post materials review
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
          Review each assessment and survey in full, including student-facing
          material, answer keys, and grading notes. This view is read-only.
        </p>

        <div className="mt-8">
          <TestReviewPanel tests={tests} />
        </div>

        <div className="mt-14 border-t border-stone-200 pt-10">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
            Pilot surveys
          </p>
          <h2 className="mt-2 text-2xl font-bold text-stone-800">
            Pre/Post survey review
          </h2>
          <p className="mt-2 max-w-3xl text-base leading-6 text-stone-500">
            Read-only preview of the questionnaires students complete before the
            pre-test and after the post-test.
          </p>
          <div className="mt-6">
            <SurveyReviewPanel surveys={surveys} />
          </div>
        </div>
      </div>
    </main>
  );
}

