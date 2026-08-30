import type { SurveyAnswers, SurveyId } from "./types";

export function surveyAnswersKey(id: SurveyId): string {
  return `survey:${id}:answers`;
}

export function surveyCompletedKey(id: SurveyId): string {
  return `survey:${id}:completed`;
}

export function isSurveyCompleted(id: SurveyId): boolean {
  return sessionStorage.getItem(surveyCompletedKey(id)) === "true";
}

export function loadSurveyAnswers(id: SurveyId): SurveyAnswers {
  const saved = sessionStorage.getItem(surveyAnswersKey(id));
  if (!saved) return {};

  try {
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SurveyAnswers;
    }
  } catch {
    /* ignore corrupt drafts */
  }

  return {};
}

export function saveSurveyAnswers(id: SurveyId, answers: SurveyAnswers): void {
  sessionStorage.setItem(surveyAnswersKey(id), JSON.stringify(answers));
}

export function markSurveyCompleted(id: SurveyId): void {
  sessionStorage.setItem(surveyCompletedKey(id), "true");
}
