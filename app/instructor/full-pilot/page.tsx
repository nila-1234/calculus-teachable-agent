import StudyResults from "@/components/instructor/study-results";
import { studyStart } from "@/lib/tests/cohort";

/**
 * The study start, as the team reads it: Eastern time (the study runs from
 * CMU). Formatted here on the server and passed down as text, so the page
 * shows it straight away with no flash or hydration mismatch.
 */
function formatSince(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FullPilotResultsPage() {
  return (
    <StudyResults
      cohort="study"
      title="Study analysis"
      since={formatSince(studyStart())}
      intro="Everyone screened since {since}. Runs are AI-graded once the post-survey is done."
    />
  );
}
