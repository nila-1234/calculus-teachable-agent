import type { GradedSubmission, LogDoc } from "./report";
import type { TestId } from "./types";

/**
 * Builds the study's export sheets from the raw log stream.
 *
 * The flow is: pre-survey -> pre-test -> scenarios -> post-test -> post-survey.
 * Every sheet here is keyed on subject_id so one participant's whole run —
 * answers, auto-grades, and timings — reads as a single record.
 */

export type Phase =
  | "welcome"
  | "pre_survey"
  | "pretest"
  | "scenarios"
  | "posttest"
  | "post_survey"
  | "other";

/** Order matters: it drives the column order and the completeness check. */
export const FLOW_PHASES: Phase[] = [
  "pre_survey",
  "pretest",
  "scenarios",
  "posttest",
  "post_survey",
];

const SURVEY_EVENTS = new Set(["survey_completed"]);
const TEST_EVENTS = new Set(["test_started", "test_item_answered", "test_completed"]);

/** Scenario ids are numeric for the instruction phase, named elsewhere. */
function phaseFromScenarioId(scenarioId: string | undefined): Phase | null {
  if (!scenarioId) return null;
  if (scenarioId === "pre") return "pre_survey";
  if (scenarioId === "post") return "post_survey";
  if (scenarioId === "pretest") return "pretest";
  if (scenarioId === "posttest") return "posttest";
  if (/^\d+$/.test(scenarioId)) return "scenarios";
  return null;
}

/** Timing events carry a route, which is a more reliable phase signal. */
export function phaseFromPath(path: string | undefined): Phase {
  if (!path) return "other";
  if (path === "/") return "welcome";
  if (path.startsWith("/survey/pre")) return "pre_survey";
  if (path.startsWith("/survey/post")) return "post_survey";
  if (path.startsWith("/test/pretest")) return "pretest";
  if (path.startsWith("/test/posttest")) return "posttest";
  if (path === "/scenarios" || /^\/\d+(\/|$)/.test(path)) return "scenarios";
  return "other";
}

export function phaseOf(doc: LogDoc): Phase {
  if (doc.event === "step_entered" || doc.event === "step_exited") {
    return phaseFromPath(doc.data?.path as string | undefined);
  }
  return phaseFromScenarioId(doc.scenario_id) ?? "other";
}

/**
 * Time per phase, derived from the gap between consecutive step_entered events
 * within a session. This needs no exit event, so an abruptly closed tab costs
 * at most the final step rather than the whole session's timings.
 */
function minutesPerPhase(docs: LogDoc[]): Record<Phase, number> {
  const ms: Record<string, number> = {};

  const bySession = new Map<string, LogDoc[]>();
  for (const doc of docs) {
    const key = doc.session_id || "unknown";
    bySession.set(key, [...(bySession.get(key) ?? []), doc]);
  }

  for (const list of bySession.values()) {
    const ordered = [...list].sort((a, b) =>
      (a.timestamp ?? "").localeCompare(b.timestamp ?? "")
    );
    const entries = ordered.filter((d) => d.event === "step_entered");

    entries.forEach((entry, index) => {
      const phase = phaseFromPath(entry.data?.path as string | undefined);
      const next = entries[index + 1];

      let span = 0;
      if (next?.timestamp && entry.timestamp) {
        span = Date.parse(next.timestamp) - Date.parse(entry.timestamp);
      } else {
        const exit = ordered.find(
          (d) =>
            d.event === "step_exited" &&
            d.data?.path === entry.data?.path &&
            (d.timestamp ?? "") >= (entry.timestamp ?? "")
        );
        const reported = exit?.data?.dwell_ms;
        if (typeof reported === "number") span = reported;
      }

      if (span > 0) ms[phase] = (ms[phase] ?? 0) + span;
    });
  }

  const out = {} as Record<Phase, number>;
  for (const phase of [...FLOW_PHASES, "welcome", "other"] as Phase[]) {
    out[phase] = Math.round(((ms[phase] ?? 0) / 60000) * 10) / 10;
  }
  return out;
}

function groupBySubject(docs: LogDoc[]): Map<string, LogDoc[]> {
  const map = new Map<string, LogDoc[]>();
  for (const doc of docs) {
    const key = doc.subject_id || "unknown";
    map.set(key, [...(map.get(key) ?? []), doc]);
  }
  return map;
}

/**
 * Master sheet: one row per participant covering the entire run.
 */
export function buildSubjectSheet(docs: LogDoc[], graded: GradedSubmission[]) {
  const gradedBy = new Map(
    graded.map((g) => [`${g.submission.subjectId}::${g.submission.testId}`, g])
  );

  const itemIds = [
    ...new Set(graded.flatMap((g) => g.result.items.map((i) => i.itemId))),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const rows = [...groupBySubject(docs).entries()]
    .map(([subjectId, list]) => {
      const times = list
        .map((d) => d.timestamp)
        .filter((t): t is string => !!t)
        .sort();

      const minutes = minutesPerPhase(list);
      const seen = new Set(list.map(phaseOf));

      const completedAt = (event: string, scenarioId: string) =>
        list
          .filter((d) => d.event === event && d.scenario_id === scenarioId)
          .map((d) => d.timestamp ?? "")
          .sort()
          .pop() ?? "";

      const pre = gradedBy.get(`${subjectId}::pretest`)?.result;
      const post = gradedBy.get(`${subjectId}::posttest`)?.result;

      const scenarioIds = new Set(
        list
          .filter((d) => /^\d+$/.test(d.scenario_id ?? ""))
          .map((d) => d.scenario_id as string)
      );

      const row: Record<string, unknown> = {
        subject_id: subjectId,
        sessions: new Set(list.map((d) => d.session_id ?? "")).size,
        total_events: list.length,

        first_seen: times[0] ?? "",
        last_seen: times[times.length - 1] ?? "",
        elapsed_min:
          times.length > 1
            ? Math.round(
                ((Date.parse(times[times.length - 1]) - Date.parse(times[0])) /
                  60000) *
                  10
              ) / 10
            : 0,
        active_min:
          Math.round(
            FLOW_PHASES.reduce((sum, p) => sum + minutes[p], 0) * 10
          ) / 10,

        pre_survey_at: completedAt("survey_completed", "pre"),
        pretest_at: completedAt("test_completed", "pretest"),
        posttest_at: completedAt("test_completed", "posttest"),
        post_survey_at: completedAt("survey_completed", "post"),

        min_pre_survey: minutes.pre_survey,
        min_pretest: minutes.pretest,
        min_scenarios: minutes.scenarios,
        min_posttest: minutes.posttest,
        min_post_survey: minutes.post_survey,

        scenarios_visited: [...scenarioIds].sort((a, b) => +a - +b).join(" "),
        scenario_events: list.filter((d) => phaseOf(d) === "scenarios").length,
        // Whether, and how much, the participant engaged with the AI.
        ai_exchanges: list.filter((d) => d.event === "ai_exchange").length,
        ai_routes_used: [
          ...new Set(
            list
              .filter((d) => d.event === "ai_exchange")
              .map((d) => String(d.data?.route ?? ""))
              .filter(Boolean)
          ),
        ]
          .sort()
          .join(" "),

        pre_points: pre?.totalPoints ?? "",
        pre_max: pre?.totalMaxPoints ?? "",
        post_points: post?.totalPoints ?? "",
        post_max: post?.totalMaxPoints ?? "",
        gain: pre && post ? post.totalPoints - pre.totalPoints : "",

        pre_complete: pre ? pre.complete : "",
        post_complete: post ? post.complete : "",
        graded_by: pre?.gradedBy ?? post?.gradedBy ?? "",
        // True only when every phase produced events AND both tests scored.
        flow_complete:
          FLOW_PHASES.every((p) => seen.has(p)) &&
          !!pre?.complete &&
          !!post?.complete,
        phases_missing: FLOW_PHASES.filter((p) => !seen.has(p)).join(" "),
      };

      for (const id of itemIds) {
        row[`pre_item_${id}`] =
          pre?.items.find((i) => i.itemId === id)?.points ?? "";
        row[`post_item_${id}`] =
          post?.items.find((i) => i.itemId === id)?.points ?? "";
      }

      return row;
    })
    .sort((a, b) =>
      String(a.subject_id).localeCompare(String(b.subject_id))
    );

  return {
    rows,
    columns: [
      "subject_id",
      "sessions",
      "total_events",
      "first_seen",
      "last_seen",
      "elapsed_min",
      "active_min",
      "pre_survey_at",
      "pretest_at",
      "posttest_at",
      "post_survey_at",
      "min_pre_survey",
      "min_pretest",
      "min_scenarios",
      "min_posttest",
      "min_post_survey",
      "scenarios_visited",
      "scenario_events",
      "ai_exchanges",
      "ai_routes_used",
      "pre_points",
      "pre_max",
      "post_points",
      "post_max",
      "gain",
      "pre_complete",
      "post_complete",
      "graded_by",
      "flow_complete",
      "phases_missing",
      ...itemIds.flatMap((id) => [`pre_item_${id}`, `post_item_${id}`]),
    ],
  };
}

/**
 * Long-format sheet: one row per answer the participant gave, across every
 * phase, with the auto-grade attached where one exists.
 */
export function buildAnswerSheet(docs: LogDoc[], graded: GradedSubmission[]) {
  const gradedBy = new Map(
    graded.map((g) => [`${g.submission.subjectId}::${g.submission.testId}`, g])
  );

  const rows: Record<string, unknown>[] = [];

  for (const doc of docs) {
    const subjectId = doc.subject_id || "unknown";
    const phase = phaseOf(doc);

    // Survey answers arrive as one object; split into a row per question.
    if (SURVEY_EVENTS.has(doc.event ?? "")) {
      const answers = (doc.data?.answers ?? {}) as Record<string, unknown>;
      for (const [itemId, value] of Object.entries(answers)) {
        rows.push({
          subject_id: subjectId,
          phase,
          source: doc.event,
          item_id: itemId,
          timestamp: doc.timestamp ?? "",
          answer_text: typeof value === "string" ? value : "",
          answer_json: typeof value === "string" ? "" : JSON.stringify(value),
          points: "",
          max_points: "",
          verdicts: "",
        });
      }
      continue;
    }

    // Test answers: one row per item, carrying the graded result.
    if (doc.event === "test_item_answered") {
      const itemId = doc.data?.item_id as string | undefined;
      if (!itemId) continue;

      const result = gradedBy.get(`${subjectId}::${doc.scenario_id}`)?.result;
      const scored = result?.items.find((i) => i.itemId === itemId);
      const open = result?.openItems.find((i) => i.itemId === itemId);
      const answer = doc.data?.answer;

      rows.push({
        subject_id: subjectId,
        phase,
        source: doc.event,
        item_id: itemId,
        timestamp: doc.timestamp ?? "",
        answer_text:
          (answer as Record<string, unknown>)?.text ??
          (answer as Record<string, unknown>)?.choiceId ??
          "",
        answer_json: JSON.stringify(answer ?? null),
        points: scored?.points ?? "",
        max_points: scored?.maxPoints ?? "",
        verdicts: open
          ? open.criteria.map((c) => `${c.id}=${c.verdict}`).join(" ")
          : "",
      });
      continue;
    }

    // Scenario work: everything the participant did during instruction.
    if (phase === "scenarios" && !TEST_EVENTS.has(doc.event ?? "")) {
      if (doc.event === "step_entered" || doc.event === "step_exited") continue;
      rows.push({
        subject_id: subjectId,
        phase,
        source: doc.event,
        item_id: String(doc.scenario_id ?? ""),
        timestamp: doc.timestamp ?? "",
        answer_text: "",
        answer_json: JSON.stringify(doc.data ?? {}),
        points: "",
        max_points: "",
        verdicts: "",
      });
    }
  }

  rows.sort(
    (a, b) =>
      String(a.subject_id).localeCompare(String(b.subject_id)) ||
      String(a.timestamp).localeCompare(String(b.timestamp))
  );

  return {
    rows,
    columns: [
      "subject_id",
      "phase",
      "source",
      "item_id",
      "timestamp",
      "answer_text",
      "answer_json",
      "points",
      "max_points",
      "verdicts",
    ],
  };
}

/** Raw event log, flattened. The audit trail behind the other two sheets. */
export function buildEventSheet(docs: LogDoc[]) {
  const rows = docs.map((doc) => ({
    subject_id: doc.subject_id ?? "",
    session_id: doc.session_id ?? "",
    phase: phaseOf(doc),
    timestamp: doc.timestamp ?? "",
    event: doc.event ?? "",
    scenario_id: doc.scenario_id ?? "",
    path: (doc.data?.path as string) ?? "",
    dwell_ms: (doc.data?.dwell_ms as number) ?? "",
    env: doc.env ?? "",
    data: JSON.stringify(doc.data ?? {}),
  }));

  return {
    rows,
    columns: [
      "subject_id",
      "session_id",
      "phase",
      "timestamp",
      "event",
      "scenario_id",
      "path",
      "dwell_ms",
      "env",
      "data",
    ],
  };
}
