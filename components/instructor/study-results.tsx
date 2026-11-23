"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Figtree } from "next/font/google";
import AppHeader from "@/components/app-header";
import Button from "@/components/button";
import type { Insights } from "@/lib/tests/insights";
import type { ScreeningQ1aGrade } from "@/lib/tests/screening-q1a";
import {
  ARMS,
  Collapsible,
  SectionHeading,
  SideMenu,
  SmallSampleNote,
  StudentPerformance,
  QuestionList,
  DataQuality,
  SurveysOverview,
  ParticipantsList,
  DownloadsPanel,
  type ParticipantRow,
  type ArmSurveys,
  TimeOverview,
  type ArmTime,
  type Arm,
  type ArmData,
} from "@/components/instructor/study-dashboard";
import type { FlowSummary } from "@/lib/tests/flow";

/**
 * Instructor results view, shared by /instructor/analysis (everyone) and
 * /instructor/full-pilot (the counterbalanced A/B design only).
 *
 * Reads the study data back out of the database, grades the pre/post tests, and
 * shows the result — with the underlying sheets downloadable as JSON or CSV.
 *
 * All the work happens in /api/grading-export; this page only renders it. That
 * endpoint requires GRADING_EXPORT_TOKEN and fails closed when it is unset, so
 * grades stay unreachable without it.
 */

const figtree = Figtree({ subsets: ["latin"] });

const TOKEN_KEY = "gradingExportToken";

/** Sections that open and close; a menu click opens them. */
const COLLAPSIBLE = new Set(["question-details", "pre-survey", "post-survey"]);

type SectionFilters = Record<"time" | "quality" | "surveys" | "participants", Arm | null>;

/** How often the study dashboard checks for new data while open. */
const REFRESH_MS = 45_000;

type Sheet = { columns: string[]; rows: Record<string, unknown>[] };

type Summary = {
  generatedAt: string;
  /** Study cohort only: who counts (screened since) and whether test- runs are shown. */
  studyStart?: string;
  includeTeamTests?: boolean;
  events: number;
  submissions: number;
  allComplete: boolean;
  incomplete: {
    subject_id: string;
    test_id: string;
    ungraded: string[];
    error: string | null;
  }[];
  subjects: Sheet;
  pairs: Sheet;
  insights: Insights;
  flow: FlowSummary;
  armViews: { lesson: ArmView; agent: ArmView };
  /** Screening Q1a, graded but outside every pre/post figure. */
  screeningQ1a?: Q1aRow[];
};

type ArmView = { insights: Insights; flow: FlowSummary };

/** A participant's screening Q1a grade (kept out of the pre/post totals). */
type Q1aRow = ScreeningQ1aGrade & { arm: string | null };


/**
 * Human-readable labels for the rubric criterion ids, so the per-criterion
 * tables read as prose rather than slugs. Unknown ids fall back to the id.
 */
const CRIT_LABELS: Record<string, string> = {
  model: "sets up the constraint",
  "one-variable": "reduces to one variable",
  derivative: "differentiates & solves",
  extremum: "justifies it is a maximum",
  quantities: "reports dimensions & area",
  "chose-c": "chose the correct function",
  "uses-examples": "uses the table's numbers",
  "price-times-quantity": "revenue = price × quantity",
  "critical-point": "identifies critical point",
  definition: "defines critical point (deriv = 0)",
  "candidate-only": "critical point only a candidate",
  verify: "must verify it is a max",
  "names-constraint": "names the range constraint",
  "identifies-conflict": "identifies the AI's conflict",
  "prompts-revision": "prompts a revision",
};
const critLabel = (id: string) => CRIT_LABELS[id] ?? id;

export type StudyResultsProps = {
  title: string;
  intro: string;
  /**
   * Server-side participant filter (see /api/grading-export). Omitted: every
   * logged participant. "study": only the new study's recruits (screened since
   * STUDY_START), refreshed automatically while the page is open.
   */
  cohort?: "study";
  /** Replaces `{since}` in `intro`: when the study starts, already formatted. */
  since?: string;
};

export default function StudyResults({
  title,
  intro,
  cohort,
  since,
}: StudyResultsProps) {
  // Study dashboard only: also show the team's own test- runs.
  const [includeTests, setIncludeTests] = useState(false);
  const cohortParam = cohort
    ? `&cohort=${cohort}${includeTests ? "&tests=1" : ""}`
    : "";
  const [token, setToken] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Each section's own arm filter; none by default (both arms).
  const [filters, setFilters] = useState<SectionFilters>({
    time: null,
    quality: null,
    surveys: null,
    participants: null,
  });
  // Which collapsible sections are open.
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Auto-refresh (study dashboard): the token that last loaded, the data
  // fingerprint at that load, and whether a background refresh is running.
  const loadedToken = useRef<string | null>(null);
  const fingerprint = useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) queueMicrotask(() => setToken(saved));
  }, []);

  /** The cheap "has anything changed?" fingerprint (study dashboard only). */
  const fetchFingerprint = useCallback(
    async (accessToken: string): Promise<string | null> => {
      const res = await fetch(
        `/api/grading-export?format=status&token=${encodeURIComponent(accessToken)}${cohortParam}`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      return typeof body?.fingerprint === "string" ? body.fingerprint : null;
    },
    [cohortParam]
  );

  /**
   * Loads the full summary. A `silent` load is a background refresh: it keeps
   * the current results on screen (and on failure keeps them, with a note)
   * instead of blanking the page.
   */
  const load = useCallback(async (accessToken: string, silent = false) => {
    if (!accessToken.trim()) {
      setError("Enter the export token to load results.");
      setStatus("error");
      return;
    }

    if (silent) setRefreshing(true);
    else {
      setStatus("loading");
      setError(null);
    }

    try {
      // Taken before the summary, so anything that lands during the load
      // changes the fingerprint and is picked up on the next check.
      const before = cohort ? await fetchFingerprint(accessToken) : null;

      const res = await fetch(
        `/api/grading-export?format=summary&token=${encodeURIComponent(accessToken)}${cohortParam}`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      sessionStorage.setItem(TOKEN_KEY, accessToken);
      loadedToken.current = accessToken;
      fingerprint.current = before;
      setSummary(body as Summary);
      setStatus("idle");
      setRefreshError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (silent) {
        setRefreshError(message);
      } else {
        setError(message);
        setStatus("error");
        setSummary(null);
        loadedToken.current = null;
      }
    } finally {
      if (silent) setRefreshing(false);
    }
  }, [cohort, cohortParam, fetchFingerprint]);

  // Study dashboard: check every REFRESH_MS while the tab is visible, and
  // reload the results only when something new has landed (a step finished or
  // a grade stored). Starts after the first successful load.
  const loaded = summary !== null;
  useEffect(() => {
    if (!cohort || !loaded) return;

    let busy = false;
    const tick = async () => {
      const accessToken = loadedToken.current;
      if (busy || !accessToken || document.hidden) return;
      busy = true;
      try {
        const now = await fetchFingerprint(accessToken);
        if (now !== fingerprint.current) await load(accessToken, true);
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : String(err));
      } finally {
        busy = false;
      }
    };

    const id = window.setInterval(() => void tick(), REFRESH_MS);
    // Coming back to the tab checks straight away rather than waiting.
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cohort, loaded, fetchFingerprint, load]);

  // Flipping "Show test runs" reloads with the new filter.
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    if (loadedToken.current) void load(loadedToken.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTests]);

  /** An export's URL (respects "Include test runs" via cohortParam). */
  const hrefFor = (format: string, extra = "") =>
    `/api/grading-export?format=${format}&token=${encodeURIComponent(token)}${cohortParam}${extra}`;

  /** Each section's own arm filter (null = both arms). */
  const viewFor = (f: Arm | null): ArmView | null =>
    summary == null
      ? null
      : f === null
        ? { insights: summary.insights, flow: summary.flow }
        : summary.armViews[f];

  const toggleOpen = (id: string, force?: boolean) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      const open = force ?? !next.has(id);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  /** Menu clicks open the collapsed section they point to. */
  const onMenuSelect = (id: string) => {
    if (COLLAPSIBLE.has(id)) toggleOpen(id, true);
  };

  const allView = viewFor(null);
  const qualityView = viewFor(filters.quality);
  const peopleView = viewFor(filters.participants);

  /** Completers for the Participants list, with their answers step by step. */
  const participantRows: ParticipantRow[] = (peopleView?.flow?.participants ?? []).map((p) => {
    const pair = summary?.pairs.rows.find((r) => r.subject_id === p.subjectId);
    const num = (v: unknown) => (typeof v === "number" ? v : null);
    const responses = (test: "pretest" | "posttest") =>
      (summary?.insights.items ?? []).flatMap((item) => {
        const r = item.detail.responses.find((x) => x.subjectId === p.subjectId && x.testId === test);
        return r
          ? [{ itemId: item.itemId, label: item.label, answer: r.answer, points: r.points, maxPoints: r.maxPoints }]
          : [];
      });
    const instr = p.instruction;
    const instruction = [
      ...instr.lesson.map((q) => {
        const last = q.tries[q.tries.length - 1];
        const result =
          q.passedOnTry != null ? `correct on try ${q.passedOnTry}` : "not answered correctly";
        return {
          id: `${q.lesson} · Q${q.number}`,
          name: q.prompt.length > 90 ? `${q.prompt.slice(0, 90)}…` : q.prompt,
          answer: `${last?.response ?? "—"} (${result}${q.hints ? `, ${q.hints} hint${q.hints === 1 ? "" : "s"}` : ""})`,
        };
      }),
      ...(instr.agentTasks.length
        ? instr.agentTasks.flatMap((t) =>
            t.items.map((it) => ({ id: t.task, name: it.title, answer: it.outcome }))
          )
        : instr.agentParts.map((a) => ({ id: a.part, name: "", answer: a.scoreLabel }))),
    ];
    return {
      id: p.subjectId,
      arm: p.arm,
      pre: num(pair?.pre_points),
      post: num(pair?.post_points),
      max: num(pair?.max_points),
      totalMin: p.totalMin ?? null,
      preSurvey: p.preSurvey,
      postSurvey: p.postSurvey,
      preTest: responses("pretest"),
      postTest: responses("posttest"),
      instruction,
    };
  });

  /** Per-arm figures for Student performance: completers only, always both arms. */
  const perArm: Record<Arm, ArmData> | null = summary
    ? (Object.fromEntries(
        ARMS.map(({ key }) => {
          const flow = summary.armViews[key].flow;
          const ids = new Set(flow.participants.map((p) => p.subjectId));
          const pairs = summary.pairs.rows.filter(
            (r) =>
              r.both_complete === true &&
              ids.has(String(r.subject_id)) &&
              typeof r.pre_points === "number" &&
              typeof r.post_points === "number"
          );
          const mean = (k: "pre_points" | "post_points") =>
            pairs.length
              ? pairs.reduce((s, r) => s + (r[k] as number), 0) / pairs.length
              : null;
          return [
            key,
            {
              completers: flow.completers,
              insights: summary.armViews[key].insights,
              avgPre: mean("pre_points"),
              avgPost: mean("post_points"),
            },
          ];
        })
      ) as Record<Arm, ArmData>)
    : null;

  const updatedAt =
    summary &&
    new Date(summary.generatedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <main className={`${figtree.className} flex min-h-screen flex-col bg-[#f4f4f2]`}>
      <AppHeader />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="gap-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="mb-8 lg:mb-0">
            {summary && <SideMenu onSelect={onMenuSelect} />}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h1 className="text-[32px] font-bold leading-tight text-stone-900">{title}</h1>
              {summary && (
                <p className="flex items-center gap-2 text-sm text-stone-600">
                  <span
                    aria-hidden
                    className={`h-2 w-2 rounded-full ${refreshError ? "bg-red-500" : "bg-lime-600"}`}
                  />
                  {cohort ? "Live · updated" : "Updated"} {updatedAt}
                  {refreshing && " · updating…"}
                  {refreshError && (
                    <span className="text-red-700" title={refreshError}>
                      · refresh failed
                    </span>
                  )}
                </p>
              )}
            </div>
            <p className="mt-2 text-[15px] leading-6 text-stone-600">
              {intro.replace("{since}", since ?? "the study start")}
            </p>

            {/* The token is only asked for until results load. */}
            {!summary && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void load(token);
                  }}
                  placeholder="Paste export token"
                  aria-label="Export token"
                  className="h-11 w-72 rounded-xl border border-[#e1e1dc] bg-white px-3 text-sm text-stone-800 focus:border-lime-600 focus:outline-none"
                />
                <Button onClick={() => void load(token)}>
                  {status === "loading" ? "Loading…" : "Load results"}
                </Button>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            {summary && perArm && allView && (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-3 border-b border-[#e1e1dc] pb-5">
                  {cohort && (
                    <label
                      title="Test runs use participant IDs starting with test-"
                      className="flex cursor-pointer items-center gap-2 text-sm text-stone-700"
                    >
                      <input
                        type="checkbox"
                        checked={includeTests}
                        onChange={(event) => setIncludeTests(event.target.checked)}
                        className="h-4 w-4 accent-lime-600"
                      />
                      Include test runs
                    </label>
                  )}
                </div>

                <SmallSampleNote
                  counts={{ agent: perArm.agent.completers, lesson: perArm.lesson.completers }}
                />

                {!summary.allComplete && (
                  <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                    <p className="font-bold">Some submissions are not fully graded.</p>
                    <p className="mt-1">
                      Their totals are partial scores, not low scores — do not treat
                      them as results.
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5">
                      {summary.incomplete.map((item) => (
                        <li key={`${item.subject_id}-${item.test_id}`}>
                          {item.subject_id} / {item.test_id} —{" "}
                          {item.error ?? `ungraded: ${item.ungraded.join(", ")}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ============================== Student performance */}
                <section id="student-performance" className="mt-10 scroll-mt-6">
                  <SectionHeading id="student-performance" title="Student performance" />
                  <StudentPerformance
                    data={perArm}
                    max={summary.insights.totalMax}
                    bands={summary.insights.scorePre.map((b) => b.label)}
                    onAllQuestions={() => {
                      toggleOpen("question-details", true);
                      requestAnimationFrame(() =>
                        document
                          .getElementById("question-details")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      );
                    }}
                  />

                  <div className="mt-8">
                    <Collapsible
                      id="question-details"
                      title="Question details"
                      meta={`${allView.insights.items.length} questions`}
                      open={openSections.has("question-details")}
                      onToggle={() => toggleOpen("question-details")}
                    >
                      <QuestionList
                        items={allView.insights.items}
                        byArm={{
                          agent: perArm.agent.completers > 0 ? perArm.agent.insights : null,
                          lesson: perArm.lesson.completers > 0 ? perArm.lesson.insights : null,
                        }}
                        criterionLabel={critLabel}
                      />
                    </Collapsible>
                  </div>
                </section>

                {/* ============================== Time */}
                <section id="time" className="mt-14 scroll-mt-6">
                  <SectionHeading
                    id="time"
                    title="Time"
                    filter={filters.time}
                    onFilter={(a) => setFilters((f) => ({ ...f, time: a }))}
                  />
                  <TimeOverview
                    filter={filters.time}
                    items={allView.insights.items}
                    data={
                      Object.fromEntries(
                        ARMS.map(({ key }) => {
                          const v = summary.armViews[key];
                          return [
                            key,
                            v.flow.completers > 0
                              ? {
                                  completers: v.flow.completers,
                                  totalMedianMin: v.flow.totalMedianMin ?? null,
                                  phases: v.flow.phases,
                                  insights: v.insights,
                                }
                              : null,
                          ];
                        })
                      ) as Record<Arm, ArmTime>
                    }
                  />
                </section>

                {/* ============================== Data quality */}
                <section id="data-quality" className="mt-14 scroll-mt-6">
                  <SectionHeading
                    id="data-quality"
                    title="Data quality"
                    filter={filters.quality}
                    onFilter={(a) => setFilters((f) => ({ ...f, quality: a }))}
                  />
                  {summary.flow?.screeningOutcomes && qualityView?.flow?.aiCheck ? (
                    <DataQuality
                      outcomes={summary.flow.screeningOutcomes}
                      aiCheck={qualityView.flow.aiCheck}
                      completed={{
                        total: summary.flow.completers,
                        agent: summary.armViews.agent.flow.completers,
                        lesson: summary.armViews.lesson.flow.completers,
                      }}
                      filter={filters.quality}
                      screeningHref={hrefFor("screening")}
                      flaggedHref={hrefFor("answers", "&flagged=1")}
                    />
                  ) : (
                    <p className="mt-3 text-sm text-stone-500">No screening data yet.</p>
                  )}
                </section>

                {/* ============================== Surveys */}
                <section id="surveys" className="mt-14 scroll-mt-6">
                  <SectionHeading
                    id="surveys"
                    title="Surveys"
                    filter={filters.surveys}
                    onFilter={(a) => setFilters((f) => ({ ...f, surveys: a }))}
                  />
                  <SurveysOverview
                    filter={filters.surveys}
                    data={
                      Object.fromEntries(
                        ARMS.map(({ key }) => {
                          const f = summary.armViews[key].flow;
                          return [
                            key,
                            f.completers > 0 ? { pre: f.preSurvey, post: f.postSurvey } : null,
                          ];
                        })
                      ) as Record<Arm, ArmSurveys>
                    }
                    preOpen={openSections.has("pre-survey")}
                    postOpen={openSections.has("post-survey")}
                    onTogglePre={() => toggleOpen("pre-survey")}
                    onTogglePost={() => toggleOpen("post-survey")}
                  />
                </section>

                {/* ============================== Participants */}
                <section id="participants" className="mt-14 scroll-mt-6">
                  <SectionHeading
                    id="participants"
                    title="Full flow per participant"
                    filter={filters.participants}
                    onFilter={(a) => setFilters((f) => ({ ...f, participants: a }))}
                  />
                  <ParticipantsList people={participantRows} />
                </section>

                {/* ============================== Downloads */}
                <section id="downloads" className="mt-14 scroll-mt-6">
                  <SectionHeading id="downloads" title="Downloads" />
                  <DownloadsPanel hrefFor={(f) => hrefFor(f)} generatedAt={summary.generatedAt} />
                </section>

              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
