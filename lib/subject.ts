const SUBJECT_ID_KEY = "subjectId";

export function getSubjectId(): string {
  if (typeof window === "undefined") return "unknown";
  return sessionStorage.getItem(SUBJECT_ID_KEY) || "unknown";
}

export function setSubjectId(id: string): void {
  if (typeof window === "undefined") return;
  const trimmed = id.trim();
  if (!trimmed) return;
  sessionStorage.setItem(SUBJECT_ID_KEY, trimmed);
}
