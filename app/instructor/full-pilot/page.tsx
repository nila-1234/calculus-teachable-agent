import StudyResults from "@/components/instructor/study-results";

export default function FullPilotResultsPage() {
  return (
    <StudyResults
      cohort="study"
      title="Full pilot results"
      intro="The new study's participants only — everyone screened since the study start, across both arms. Each run is graded by AI as soon as the participant finishes the post-survey, against their own test version; runs that stop partway are not graded. Updates automatically while this page is open."
    />
  );
}
