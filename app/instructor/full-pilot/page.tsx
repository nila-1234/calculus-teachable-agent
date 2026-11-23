import StudyResults from "@/components/instructor/study-results";

export default function FullPilotResultsPage() {
  return (
    <StudyResults
      cohort="full-pilot"
      title="Full pilot results"
      intro="Only participants on the counterbalanced design: screening Q5 as the pre-test's Q1a, Versions A/B for the pre/post tests, and Q1b–Q1f. Earlier runs and the test-question pilot are left out. Graded against each participant's own version."
    />
  );
}
