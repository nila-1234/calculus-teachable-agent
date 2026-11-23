"use client";

/**
 * Presentation pieces for the instructor results dashboard
 * (components/instructor/study-results.tsx): the arm colours, the side menu,
 * per-section arm filters, collapsible cards, and the Student performance
 * section. Pure UI — every number comes from the /api/grading-export summary.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  Cross2Icon,
  DownloadIcon,
  InfoCircledIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import MathDisplay from "@/components/math-display";
import { GOAL_LABELS, type Insights, type ItemStat } from "@/lib/tests/insights";
import type { AiCheck } from "@/lib/tests/ai-check";
import type { ScreeningOutcomes, ScreeningPerson } from "@/lib/tests/screening-outcomes";
import type { SurveyItemSummary } from "@/lib/tests/flow";

/* ------------------------------------------------------------------ arms -- */

/** The arm keys as stored in the data ("lesson" is the comparison condition). */
export type Arm = "agent" | "lesson";

/**
 * Display order and colours. Agent is always listed first. Orange is reserved
 * for Agent and blue for Control: nothing else on the page uses them.
 */
export const ARMS: { key: Arm; label: string; color: string; tint: string; ink: string }[] = [
  { key: "agent", label: "Agent", color: "#e8892b", tint: "#fbe9d6", ink: "#8a4a0c" },
  { key: "lesson", label: "Control", color: "#2b63c6", tint: "#dde7f8", ink: "#1d4385" },
];

export const armLabel = (key: string | null | undefined) =>
  ARMS.find((a) => a.key === key)?.label ?? "—";

export const armMeta = (key: Arm) => ARMS.find((a) => a.key === key)!;

/** Show the "small sample" note while either arm has fewer completers than this. */
export const MIN_COMPLETERS = 10;

/** Page styling shared by every section. */
export const CARD = "rounded-[14px] border border-[#e1e1dc] bg-white";

export function Swatch({ arm, className = "" }: { arm: Arm; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3 w-3 shrink-0 rounded-[3px] ${className}`}
      style={{ background: armMeta(arm).color }}
    />
  );
}

/** A small arm tag (e.g. on a participant card). */
export function ArmTag({ arm }: { arm: string | null }) {
  const meta = ARMS.find((a) => a.key === arm);
  if (!meta) {
    return (
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">—</span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ background: meta.tint, color: meta.ink }}
    >
      {meta.label}
    </span>
  );
}

/** The "ARMS" key in the header. */
export function ArmsLegend() {
  return (
    <div className={`${CARD} inline-flex items-center gap-4 rounded-lg px-3 py-2`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Arms
      </span>
      {ARMS.map((a) => (
        <span key={a.key} className="inline-flex items-center gap-1.5 text-sm text-stone-700">
          <Swatch arm={a.key} />
          {a.label}
        </span>
      ))}
    </div>
  );
}

/** Quiet grey note shown while the sample is small. */
export function SmallSampleNote({ counts }: { counts: Record<Arm, number> }) {
  if (ARMS.every((a) => counts[a.key] >= MIN_COMPLETERS)) return null;
  return (
    <div className="mt-4 flex items-center gap-2.5 rounded-[10px] bg-[#e9e9e5] px-4 py-3 text-sm text-stone-700">
      <InfoCircledIcon className="h-4 w-4 shrink-0 text-stone-500" />
      <span>
        <span className="font-semibold">Small sample so far:</span>{" "}
        {counts.agent} Agent and {counts.lesson} Control completers.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- side menu -- */

export type MenuItem = { id: string; label: string; sub?: boolean };

export const MENU: MenuItem[] = [
  { id: "student-performance", label: "Student performance" },
  { id: "question-details", label: "Question details", sub: true },
  { id: "time", label: "Time" },
  { id: "data-quality", label: "Data quality" },
  { id: "screening", label: "Screening", sub: true },
  { id: "ai-flags", label: "AI-use flags", sub: true },
  { id: "surveys", label: "Surveys" },
  { id: "pre-survey", label: "Pre-survey", sub: true },
  { id: "post-survey", label: "Post-survey", sub: true },
  { id: "participants", label: "Full flow per participant" },
  { id: "downloads", label: "Downloads" },
];

/**
 * Sticky "On this page" menu. Highlights the section in view (the most
 * specific menu entry whose element crosses the top third of the viewport) and
 * smooth-scrolls on click; `onSelect` lets the page open a collapsed section.
 */
export function SideMenu({ onSelect }: { onSelect?: (id: string) => void }) {
  const [active, setActive] = useState<string>(MENU[0].id);

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Sections contain their sub-sections, so the last visible entry in menu
        // order is the most specific one in view.
        const current = [...MENU].reverse().find((m) => visible.has(m.id));
        if (current) setActive(current.id);
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    for (const m of MENU) {
      const el = document.getElementById(m.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => {
    onSelect?.(id);
    setActive(id);
    // After any section opened by onSelect has rendered.
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        On this page
      </p>
      <ul className="mt-2 space-y-0.5">
        {MENU.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => go(m.id)}
              aria-current={active === m.id ? "location" : undefined}
              className={`w-full rounded-lg py-1.5 text-left transition-colors ${
                m.sub ? "pl-6 pr-3 text-[13px]" : "px-3 text-sm"
              } ${
                active === m.id
                  ? "bg-lime-100 font-semibold text-lime-900"
                  : "text-stone-700 hover:bg-stone-200/60"
              }`}
            >
              {m.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------- section bits -- */

/** The emoji shown left of each main section's title. */
const SECTION_EMOJI: Record<string, string> = {
  "student-performance": "📈",
  time: "⏱️",
  "data-quality": "🔍",
  surveys: "📋",
  participants: "🧭",
  downloads: "📥",
};

/** A section heading, with an optional arm-filter control on the right. */
export function SectionHeading({
  id,
  title,
  filter,
  onFilter,
}: {
  id: string;
  title: string;
  /** Pass `filter`/`onFilter` to give the section its own arm filter. */
  filter?: Arm | null;
  onFilter?: (arm: Arm | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`${id}-heading`} className="text-2xl font-bold text-stone-900">
          {SECTION_EMOJI[id] && (
            <span aria-hidden className="mr-2">
              {SECTION_EMOJI[id]}
            </span>
          )}
          {title}
        </h2>
        {filter && onFilter && <FilterChip arm={filter} onClear={() => onFilter(null)} />}
      </div>
      {onFilter && <FilterButton value={filter ?? null} onChange={onFilter} />}
    </div>
  );
}

function FilterChip({ arm, onClear }: { arm: Arm; onClear: () => void }) {
  const meta = armMeta(arm);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-xs font-semibold"
      style={{ background: meta.tint, color: meta.ink }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label} only
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${meta.label} filter`}
        className="rounded-full p-0.5 hover:bg-black/10"
      >
        <Cross2Icon className="h-3 w-3" />
      </button>
    </span>
  );
}

function FunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden>
      <path
        d="M2.5 3h11l-4.25 5.1V12.5l-2.5 1.25V8.1L2.5 3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterButton({
  value,
  onChange,
}: {
  value: Arm | null;
  onChange: (arm: Arm | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (arm: Arm | null) => {
    onChange(arm);
    setOpen(false);
  };
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Filter by arm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${CARD} flex h-11 w-11 items-center justify-center rounded-[10px] text-stone-600 hover:text-stone-900`}
      >
        <FunnelIcon />
      </button>
      {open && (
        <>
          {/* Click-away layer. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className={`${CARD} absolute right-0 z-20 mt-2 w-44 p-1 shadow-lg`}
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Show arm
            </p>
            {ARMS.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitemradio"
                aria-checked={value === a.key}
                onClick={() => pick(a.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 ${
                  value === a.key ? "font-semibold text-stone-900" : "text-stone-700"
                }`}
              >
                <Swatch arm={a.key} />
                {a.label} only
              </button>
            ))}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === null}
              onClick={() => pick(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 ${
                value === null ? "font-semibold text-stone-900" : "text-stone-700"
              }`}
            >
              Both arms
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** A white card whose body opens and closes; `open` is controlled by the page. */
export function Collapsible({
  id,
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div id={id} className={`${CARD} scroll-mt-6`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-[15px] text-stone-600">
          <span className="font-semibold text-stone-900">{title}</span>
          {meta && <> · {meta}</>}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={`${id}-body`} className="border-t border-[#e1e1dc] px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- student performance -- */

type ArmData = {
  completers: number;
  insights: Insights;
  /** Average pre / post totals over completers with both tests, or null. */
  avgPre: number | null;
  avgPost: number | null;
};

/** "17", "17.5" — one decimal only when needed. */
const num = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

const signedNum = (n: number) => {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return "0";
  return `${r > 0 ? "+" : "−"}${num(Math.abs(r))}`;
};

const pctText = (v: number) => `${Math.round(v * 100)}%`;

function Empty() {
  return <p className="text-sm text-stone-500">No completers yet</p>;
}

function ArmName({ arm }: { arm: Arm }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-stone-900">
      <Swatch arm={arm} />
      {armMeta(arm).label}
    </span>
  );
}

function ArmSummaryCard({ arm, d, max }: { arm: Arm; d: ArmData; max: number }) {
  const has = d.completers > 0 && d.avgPre != null && d.avgPost != null;
  return (
    <div className={`${CARD} p-6`}>
      <div className="flex items-center justify-between gap-2">
        <ArmName arm={arm} />
        <span className="text-sm text-stone-500">
          {d.completers} {d.completers === 1 ? "completer" : "completers"}
        </span>
      </div>
      <div className="mt-3">
        {has ? (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[32px] font-bold leading-none text-stone-900">
              {num(d.avgPre!)} → {num(d.avgPost!)}
            </span>
            <span className="text-sm text-stone-600">
              average total score, out of {max} ({signedNum(d.avgPost! - d.avgPre!)})
            </span>
          </p>
        ) : (
          <Empty />
        )}
      </div>
    </div>
  );
}

/** Pre (hollow) → post (filled) on a 0–100% track, in the arm colour. */
function Dumbbell({ arm, pre, post, gain }: { arm: Arm; pre: number; post: number; gain: number }) {
  const color = armMeta(arm).color;
  const lo = Math.min(pre, post) * 100;
  const hi = Math.max(pre, post) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-stone-700">
          {pctText(pre)} → {pctText(post)}
        </span>
        <span className="font-bold text-stone-900">{signedNum(gain)} pts</span>
      </div>
      <div className="relative mx-1.5 mt-3 h-3">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-stone-200" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2"
          style={{ left: `${lo}%`, width: `${hi - lo}%`, background: color }}
        />
        <span
          title={`Pre-test ${pctText(pre)}`}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
          style={{ left: `${pre * 100}%`, borderColor: color }}
        />
        <span
          title={`Post-test ${pctText(post)}`}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${post * 100}%`, background: color }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-stone-400">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function SkillsCard({ data }: { data: Record<Arm, ArmData> }) {
  const goals = data.agent.insights.goals.length
    ? data.agent.insights.goals.map((g) => g.goal)
    : data.lesson.insights.goals.map((g) => g.goal);
  return (
    <div className={`${CARD} overflow-x-auto px-6 py-2`}>
      <div className="grid min-w-[560px] grid-cols-[1fr_1.4fr_1.4fr] gap-x-8">
        <div className="border-b border-[#ecece8] py-4 text-sm font-semibold text-stone-600">Skill</div>
        {ARMS.map((a) => (
          <div key={a.key} className="border-b border-[#ecece8] py-4 text-sm font-semibold text-stone-600">
            <span className="inline-flex items-center gap-2">
              <Swatch arm={a.key} />
              {a.label}
            </span>
          </div>
        ))}
        {goals.map((goal, i) => (
          <div key={goal} className="contents">
            <div
              className={`flex items-center py-6 text-[15px] text-stone-900 ${
                i < goals.length - 1 ? "border-b border-[#ecece8]" : ""
              }`}
            >
              {GOAL_LABELS[goal]}
            </div>
            {ARMS.map((a) => {
              const g = data[a.key].insights.goals.find((x) => x.goal === goal);
              const ok =
                data[a.key].completers > 0 &&
                g?.preAccuracy != null &&
                g.postAccuracy != null;
              return (
                <div
                  key={a.key}
                  className={`flex flex-col justify-center py-6 ${
                    i < goals.length - 1 ? "border-b border-[#ecece8]" : ""
                  }`}
                >
                  {ok ? (
                    <Dumbbell
                      arm={a.key}
                      pre={g!.preAccuracy!}
                      post={g!.postAccuracy!}
                      gain={g!.gain ?? (g!.postAccuracy! - g!.preAccuracy!) * 100}
                    />
                  ) : (
                    <Empty />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MostMissedCard({ arm, d }: { arm: Arm; d: ArmData }) {
  const color = armMeta(arm).color;
  const items =
    d.completers > 0
      ? [...d.insights.items]
          // Only questions actually missed: one everyone got fully right
          // (100%) isn't listed, so the card can show fewer than three.
          .filter((it) => it.postN > 0 && it.postAccuracy != null && it.postAccuracy < 1)
          .sort(
            (a, b) =>
              a.postAccuracy! - b.postAccuracy! ||
              a.itemId.localeCompare(b.itemId, undefined, { numeric: true })
          )
          .slice(0, 3)
      : [];
  return (
    <div className={`${CARD} p-6`}>
      <ArmName arm={arm} />
      <div className="mt-4 space-y-4">
        {d.completers === 0 ? (
          <Empty />
        ) : items.length === 0 ? (
          <p className="text-sm text-stone-500">No questions missed</p>
        ) : (
          items.map((it) => (
            <div key={it.itemId}>
              <div className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="min-w-0 truncate">
                  <span className="font-bold text-stone-900">Q{it.itemId}</span>{" "}
                  <span className="text-stone-600">{GOAL_LABELS[it.goal]}</span>
                </span>
                <span className="font-semibold text-stone-900">{pctText(it.postAccuracy!)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-stone-100">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `max(6px, ${it.postAccuracy! * 100}%)`,
                    background: color,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DistributionPanel({
  title,
  bands,
  data,
  which,
}: {
  title: string;
  bands: string[];
  data: Record<Arm, ArmData>;
  which: "scorePre" | "scorePost";
}) {
  const share = (arm: Arm, label: string) => {
    const list = data[arm].insights[which];
    const total = list.reduce((s, b) => s + b.count, 0);
    if (!total) return 0;
    return (list.find((b) => b.label === label)?.count ?? 0) / total;
  };
  return (
    <div>
      <p className="text-[15px] font-semibold text-stone-900">{title}</p>
      <div className="mt-3 flex gap-2">
        <div className="flex h-44 flex-col justify-between pb-0 text-right text-[11px] text-stone-400">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="flex-1">
          <div className="relative h-44 border-b border-stone-300">
            <div className="absolute inset-x-0 top-0 border-t border-stone-100" />
            <div className="absolute inset-x-0 top-1/2 border-t border-stone-100" />
            <div className="absolute inset-0 flex">
              {bands.map((label) => (
                <div key={label} className="flex flex-1 items-end justify-center gap-0.5">
                  {ARMS.map((a) => {
                    const s = share(a.key, label);
                    return (
                      <div
                        key={a.key}
                        title={`${a.label} · ${label}: ${Math.round(s * 100)}%`}
                        className="w-[30%] max-w-5"
                        style={{ height: `${s * 100}%`, background: a.color }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex">
            {bands.map((label) => (
              <span key={label} className="flex-1 text-center text-[11px] text-stone-500">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StudentPerformance({
  data,
  max,
  bands,
  onAllQuestions,
}: {
  data: Record<Arm, ArmData>;
  /** Points each test is out of. */
  max: number;
  /** The score band labels, in order. */
  bands: string[];
  onAllQuestions: () => void;
}) {
  return (
    <>
      <p className="mt-1 text-sm text-stone-600">
        Pre-test vs post-test, for participants who finished every step.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ARMS.map((a) => (
          <ArmSummaryCard key={a.key} arm={a.key} d={data[a.key]} max={max} />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-stone-900">How each skill moved</h3>
        <div className="flex items-center gap-4 text-sm text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-stone-500" /> Pre-test
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-500" /> Post-test
          </span>
        </div>
      </div>
      <div className="mt-3">
        <SkillsCard data={data} />
      </div>

      <h3 className="mt-10 text-lg font-semibold text-stone-900">
        Most-missed questions on the post-test
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Up to 3 by lowest % correct on the post-test.{" "}
        <button
          type="button"
          onClick={onAllQuestions}
          className="font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800"
        >
          All questions
        </button>
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {ARMS.map((a) => (
          <MostMissedCard key={a.key} arm={a.key} d={data[a.key]} />
        ))}
      </div>

      <h3 className="mt-10 text-lg font-semibold text-stone-900">Score distribution</h3>
      <p className="mt-1 text-sm text-stone-600">
        Share of each arm&apos;s completers per score band, out of {max}.
      </p>
      <div className={`${CARD} mt-3 grid gap-8 p-6 md:grid-cols-2`}>
        <DistributionPanel title="Pre-test" bands={bands} data={data} which="scorePre" />
        <DistributionPanel title="Post-test" bands={bands} data={data} which="scorePost" />
      </div>
    </>
  );
}

export type { ArmData };

/* ------------------------------------------------------- question details -- */

const GOAL_ORDER: ItemStat["goal"][] = ["procedural", "communication", "collaboration"];

/** "Q2.2 explain concept (show work)" → { id: "Q2.2", name: "Explain concept", type: "show work" }. */
export function parseItemLabel(label: string): { id: string; name: string; type: string } {
  const m = label.match(/^(Q\S+)\s+(.*?)(?:\s*\(([^)]*)\))?$/);
  if (!m) return { id: label, name: "", type: "" };
  const raw = m[2].trim();
  const name = raw ? raw[0].toUpperCase() + raw.slice(1) : "";
  const type = (m[3] ?? raw).replace(/\bMC\b/, "multiple choice").trim().toLowerCase();
  return { id: m[1], name, type };
}

/** "+20 pts", "−100 pts", "0" — gain in percentage points. */
const gainText = (pre: number, post: number) => {
  const g = Math.round((post - pre) * 100 * 10) / 10;
  return g === 0 ? "0" : `${signedNum(g)} pts`;
};

/** Pre (hollow) → post (filled) joined by a thick line on a 0–100% track. */
function MiniDumbbell({ arm, pre, post }: { arm: Arm; pre: number; post: number }) {
  const color = armMeta(arm).color;
  const lo = Math.min(pre, post) * 100;
  const hi = Math.max(pre, post) * 100;
  return (
    <div className="relative mx-1.5 mt-2 h-3">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e1e1dc]" />
      <div
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
        style={{ left: `${lo}%`, width: `${hi - lo}%`, background: color }}
      />
      <span
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
        style={{ left: `${pre * 100}%`, borderColor: color }}
      />
      <span
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${post * 100}%`, background: color }}
      />
    </div>
  );
}

function ArmCell({ arm, item }: { arm: Arm; item: ItemStat | undefined }) {
  if (!item || item.preAccuracy == null || item.postAccuracy == null) {
    return <span className="text-[15px] text-stone-400">—</span>;
  }
  return (
    <div className="pr-2">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-[#5e5e57]">
          {pctText(item.preAccuracy)} → {pctText(item.postAccuracy)}
        </span>
        <span className="font-bold text-stone-900">
          {gainText(item.preAccuracy, item.postAccuracy)}
        </span>
      </div>
      <MiniDumbbell arm={arm} pre={item.preAccuracy} post={item.postAccuracy} />
    </div>
  );
}

/** Dots for one point value: up to 4 shown, then one dot plus a count. */
function Dots({ n, arm, filled }: { n: number; arm: Arm; filled: boolean }) {
  if (n === 0) return null;
  const color = armMeta(arm).color;
  const dot = (key: number) => (
    <span
      key={key}
      className={`h-2.5 w-2.5 rounded-full ${filled ? "" : "border-2 bg-white"}`}
      style={filled ? { background: color } : { borderColor: color }}
    />
  );
  return n > 4 ? (
    <span className="inline-flex items-center gap-0.5">
      {dot(0)}
      <span className="text-[11px] text-[#5e5e57]">×{n}</span>
    </span>
  ) : (
    <>{Array.from({ length: n }, (_, i) => dot(i))}</>
  );
}

function ScoreSpread({ max, byArm }: { max: number; byArm: Record<Arm, ItemStat | undefined> }) {
  const values = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-[15px] text-[#6b6b63]">
        <span className="font-semibold text-stone-900">Score spread</span> · out of {max}
      </p>
      <div className="mt-3 space-y-3">
        {ARMS.map((a) => {
          const item = byArm[a.key];
          const responses = item?.detail.responses ?? [];
          const count = (test: "pretest" | "posttest", v: number) =>
            responses.filter((r) => r.testId === test && r.points === v).length;
          return (
            <div key={a.key} className="grid grid-cols-[84px_1fr] items-start gap-2">
              <span className="inline-flex items-center gap-2 pt-2 text-[13px] text-stone-800">
                <Swatch arm={a.key} />
                {a.label}
              </span>
              {responses.length === 0 ? (
                <p className="pt-2 text-[13px] text-[#6b6b63]">No completers yet</p>
              ) : (
                <div>
                  <div className="flex gap-1.5">
                    {values.map((v) => (
                      <div
                        key={v}
                        title={`${v} pt: ${count("pretest", v)} pre, ${count("posttest", v)} post`}
                        className="flex h-9 min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 rounded-md bg-[#f1f1ee] px-0.5"
                      >
                        <Dots n={count("pretest", v)} arm={a.key} filled={false} />
                        <Dots n={count("posttest", v)} arm={a.key} filled />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    {values.map((v) => (
                      <span key={v} className="flex-1 text-center text-[11px] text-[#6b6b63]">
                        {v} pt
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RubricCard({
  byArm,
  criterionLabel,
}: {
  byArm: Record<Arm, ItemStat | undefined>;
  criterionLabel: (id: string) => string;
}) {
  const label = (id: string) => {
    const l = criterionLabel(id);
    return l ? l[0].toUpperCase() + l.slice(1) : id;
  };
  return (
    <div className={`${CARD} p-5`}>
      <p className="text-[15px] text-[#6b6b63]">
        <span className="font-semibold text-stone-900">Rubric</span> · % who met each point, pre + post
      </p>
      <div className="mt-3 space-y-4">
        {ARMS.map((a) => {
          const criteria = byArm[a.key]?.detail.criteria ?? [];
          if (criteria.length === 0) {
            return (
              <p key={a.key} className="text-[13px] text-[#6b6b63]">
                {a.label}: no completers yet
              </p>
            );
          }
          return (
            <div key={a.key} className="space-y-3">
              <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-stone-800">
                <Swatch arm={a.key} />
                {a.label}
              </p>
              {criteria.map((c) => {
                const met = Math.round(c.metRate * c.n);
                return (
                  <div key={c.id}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="text-stone-800">{label(c.id)}</span>
                      <span className="whitespace-nowrap">
                        <span className="font-semibold text-stone-900">
                          {Math.round(c.metRate * 100)}%
                        </span>{" "}
                        <span className="text-[#6b6b63]">
                          ({met}/{c.n})
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-[#ecece8]">
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `max(4px, ${c.metRate * 100}%)`, background: a.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Q_GRID = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_24px] items-center gap-x-6";

/**
 * Every test question, grouped by assessment goal, with each arm's pre → post
 * (% of max marks) side by side. A row expands to its score spread and rubric.
 * `byArm` holds each arm's completer-only insights (null when it has none).
 */
export function QuestionList({
  items,
  byArm,
  criterionLabel,
}: {
  /** All questions, for ordering and labels. */
  items: ItemStat[];
  byArm: Record<Arm, Insights | null>;
  criterionLabel: (id: string) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const find = (arm: Arm, itemId: string) =>
    byArm[arm]?.items.find((i) => i.itemId === itemId);
  const groups = GOAL_ORDER.map((goal) => ({
    goal,
    items: items.filter((i) => i.goal === goal),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[#5e5e57]">
          % of max marks, pre-test → post-test. Click a question for its rubric and score spread.
        </p>
        <div className="flex items-center gap-4 text-[13px] text-[#5e5e57]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-stone-500" /> Pre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-500" /> Post
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className={`${Q_GRID} mt-3 border-b border-[#e1e1dc] px-3 pb-2 text-[13px] font-semibold text-[#5e5e57]`}>
            <span>Question</span>
            {ARMS.map((a) => (
              <span key={a.key} className="inline-flex items-center gap-2">
                <Swatch arm={a.key} />
                {a.label}
              </span>
            ))}
            <span />
          </div>

          {groups.map((g, gi) => (
            <div
              key={g.goal}
              className={gi > 0 ? "mt-3 border-t border-[#d6d6d0] pt-3" : "pt-1"}
            >
              <p className="px-3 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wider text-[#6b6b63]">
                {GOAL_LABELS[g.goal]}
              </p>
              {g.items.map((item) => {
                const { id, name, type } = parseItemLabel(item.label);
                const isOpen = open === item.itemId;
                const armItems: Record<Arm, ItemStat | undefined> = {
                  agent: find("agent", item.itemId),
                  lesson: find("lesson", item.itemId),
                };
                const hasRubric = ARMS.some(
                  (a) => (armItems[a.key]?.detail.criteria.length ?? 0) > 0
                );
                return (
                  <div
                    key={item.itemId}
                    className={`rounded-xl ${isOpen ? "bg-[#f7f7f4]" : ""}`}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : item.itemId)}
                      className={`${Q_GRID} min-h-14 w-full rounded-xl px-3 py-2 text-left hover:bg-[#f7f7f4]`}
                    >
                      <span className="text-[15px] text-stone-900">
                        <span className="font-bold">{id}</span> {name}
                        {type && <span className="text-[#6b6b63]"> · {type}</span>}
                      </span>
                      {ARMS.map((a) => (
                        <ArmCell key={a.key} arm={a.key} item={armItems[a.key]} />
                      ))}
                      <ChevronDownIcon
                        className={`h-4 w-4 text-stone-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div
                        className={`grid gap-4 px-3 pb-4 pt-1 ${hasRubric ? "md:grid-cols-2" : ""}`}
                      >
                        <ScoreSpread max={item.maxPoints} byArm={armItems} />
                        {hasRubric && (
                          <RubricCard byArm={armItems} criterionLabel={criterionLabel} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ time -- */

/** Light range-bar tints per arm (fastest → slowest). */
const RANGE_TINT: Record<Arm, string> = { agent: "#f8d9b8", lesson: "#c5d5f2" };

/** "45s" / "1m 16s". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const r = Math.round(seconds);
  const m = Math.floor(r / 60);
  return m > 0 ? `${m}m ${r % 60}s` : `${r}s`;
}

const medianOf = (values: number[]): number | null => {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

type PhaseSummary = { key: string; label: string; medianMin: number | null; n: number }[];

/** What the Time section needs from one arm (null when the arm has no completers). */
export type ArmTime = {
  completers: number;
  totalMedianMin: number | null;
  phases: PhaseSummary;
  insights: Insights;
} | null;

const PHASE_ROWS: { label: string; key: Record<Arm, string>; note?: string }[] = [
  { label: "Pre-survey", key: { agent: "pre_survey", lesson: "pre_survey" } },
  { label: "Pre-test", key: { agent: "pretest", lesson: "pretest" } },
  {
    label: "Instruction",
    key: { agent: "instruction_agent", lesson: "lesson" },
    note: "Differs by arm",
  },
  { label: "Post-test", key: { agent: "posttest", lesson: "posttest" } },
  { label: "Post-survey", key: { agent: "post_survey", lesson: "post_survey" } },
];

const phaseMedian = (t: ArmTime, key: string) => {
  const p = t?.phases.find((x) => x.key === key);
  return p && p.n > 0 && p.medianMin != null ? p.medianMin : null;
};

/** "Lesson 1 · 5.0 min · Lesson 2 · 3.3 min" / "Question · 2.1 min · Create rubric · …". */
function instructionBreakdown(arm: Arm, t: ArmTime): string | null {
  if (!t) return null;
  const prefix = arm === "agent" ? "agent_" : "lesson_";
  const parts = t.phases
    .filter((p) => p.key.startsWith(prefix) && p.n > 0 && p.medianMin != null)
    .map((p) => {
      const label = p.label[0] + p.label.slice(1).toLowerCase();
      return `${label} · ${p.medianMin!.toFixed(1)} min`;
    });
  return parts.length ? parts.join(" · ") : null;
}

function TotalCard({ arm, t }: { arm: Arm; t: ArmTime }) {
  const has = t && t.completers > 0 && t.totalMedianMin != null;
  return (
    <div className={`${CARD} p-6`}>
      <ArmName arm={arm} />
      <p className="mt-3 text-[32px] font-bold leading-none text-stone-900">
        {has ? `${Math.round(t!.totalMedianMin!)} min` : "—"}
      </p>
      <p className="mt-3 text-[13px] text-[#5e5e57]">
        {has
          ? `median total, screening not included · ${t!.completers} ${
              t!.completers === 1 ? "completer" : "completers"
            }`
          : "No completers yet"}
      </p>
    </div>
  );
}

function PhaseCard({ arms, data }: { arms: Arm[]; data: Record<Arm, ArmTime> }) {
  const scale = Math.max(
    0.1,
    ...PHASE_ROWS.flatMap((r) => arms.map((a) => phaseMedian(data[a], r.key[a]) ?? 0))
  );
  return (
    <div className={`${CARD} px-6 py-2`}>
      {PHASE_ROWS.map((row, i) => (
        <div
          key={row.label}
          className={`grid grid-cols-[160px_minmax(0,1fr)] items-center gap-4 py-4 ${
            i < PHASE_ROWS.length - 1 ? "border-b border-[#ecece8]" : ""
          }`}
        >
          <div>
            <p className="text-[15px] text-stone-900">{row.label}</p>
            {row.note && <p className="text-[12px] text-[#6b6b63]">{row.note}</p>}
          </div>
          <div className="space-y-2">
            {arms.map((a) => {
              const m = phaseMedian(data[a], row.key[a]);
              const breakdown = row.note ? instructionBreakdown(a, data[a]) : null;
              return (
                <div key={a}>
                  <div className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-3">
                    <div className="h-3.5 rounded-[4px] bg-[#f1f1ee]">
                      {m != null && (
                        <div
                          className="h-3.5 rounded-[4px]"
                          title={`${armMeta(a).label}: ${m.toFixed(1)} min`}
                          style={{ width: `${(m / scale) * 100}%`, background: armMeta(a).color }}
                        />
                      )}
                    </div>
                    <span className="text-right text-[13px] font-semibold text-stone-900">
                      {m == null ? "—" : `${m.toFixed(1)} min`}
                    </span>
                  </div>
                  {breakdown && <p className="mt-1 text-[12px] text-[#5e5e57]">{breakdown}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type Spread = { min: number; median: number; max: number } | null;

function spreadOf(t: ArmTime, itemId: string, test: "pretest" | "posttest"): Spread {
  const secs =
    t?.insights.items
      .find((i) => i.itemId === itemId)
      ?.detail.responses.filter((r) => r.testId === test && r.seconds != null)
      .map((r) => r.seconds as number) ?? [];
  if (!secs.length) return null;
  return { min: Math.min(...secs), median: medianOf(secs)!, max: Math.max(...secs) };
}

function SpreadLine({ arm, s, scale }: { arm: Arm; s: Spread; scale: number }) {
  const pos = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_52px] items-center gap-2">
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-[#f1f1ee]" />
        {s && (
          <>
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{
                left: pos(s.min),
                width: `max(2px, calc(${pos(s.max)} - ${pos(s.min)}))`,
                background: RANGE_TINT[arm],
              }}
            />
            <span
              title={`${armMeta(arm).label}: ${fmtDuration(s.min)}–${fmtDuration(s.max)}, median ${fmtDuration(s.median)}`}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ left: pos(s.median), background: armMeta(arm).color }}
            />
          </>
        )}
      </div>
      <span className="text-right text-[12px] text-[#5e5e57]">{s ? fmtDuration(s.median) : "—"}</span>
    </div>
  );
}

function Axis({ minutes }: { minutes: number }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_52px] gap-2">
      <div className="relative h-4 text-[11px] text-[#6b6b63]">
        {Array.from({ length: minutes + 1 }, (_, m) => (
          <span
            key={m}
            className="absolute -translate-x-1/2 first:translate-x-0"
            style={{ left: `${(m / minutes) * 100}%` }}
          >
            {m === 0 ? "0" : `${m}m`}
          </span>
        ))}
      </div>
      <span />
    </div>
  );
}

const T_GRID = "grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-x-8";

function QuestionTimeCard({
  items,
  arms,
  data,
}: {
  items: ItemStat[];
  arms: Arm[];
  data: Record<Arm, ArmTime>;
}) {
  const rows = items.map((item) => {
    const spreads = Object.fromEntries(
      arms.map((a) => [
        a,
        { pre: spreadOf(data[a], item.itemId, "pretest"), post: spreadOf(data[a], item.itemId, "posttest") },
      ])
    ) as Record<Arm, { pre: Spread; post: Spread }>;
    // Sort key: median over every answer time shown (both tests, visible arms).
    const all = arms.flatMap(
      (a) =>
        data[a]?.insights.items
          .find((i) => i.itemId === item.itemId)
          ?.detail.responses.filter((r) => r.seconds != null)
          .map((r) => r.seconds as number) ?? []
    );
    return { item, spreads, sortKey: medianOf(all) ?? -1 };
  });
  rows.sort((a, b) => b.sortKey - a.sortKey);

  const longest = Math.max(
    0,
    ...rows.flatMap((r) => arms.flatMap((a) => [r.spreads[a].pre?.max ?? 0, r.spreads[a].post?.max ?? 0]))
  );
  const minutes = Math.max(3, Math.ceil(longest / 60));
  const scale = minutes * 60;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        <div className={`${T_GRID} border-b border-[#ecece8] py-3 text-[13px] font-semibold text-[#5e5e57]`}>
          <span>Question</span>
          <span>Pre-test</span>
          <span>Post-test</span>
        </div>
        {rows.map(({ item, spreads }) => {
          const { id, name } = parseItemLabel(item.label);
          return (
            <div key={item.itemId} className={`${T_GRID} items-center border-b border-[#ecece8] py-2.5`}>
              <span className="text-[14px] text-stone-900">
                <span className="font-bold">{id}</span> {name}
              </span>
              {(["pre", "post"] as const).map((test) => (
                <div key={test} className="space-y-0.5">
                  {arms.map((a) => (
                    <SpreadLine key={a} arm={a} s={spreads[a][test]} scale={scale} />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
        <div className={`${T_GRID} items-start pb-3`}>
          <div className="mt-2 flex items-center gap-3 text-[12px] text-[#5e5e57]">
            {arms.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5">
                <Swatch arm={a} className="h-2.5 w-2.5" />
                {armMeta(a).label}
              </span>
            ))}
          </div>
          <Axis minutes={minutes} />
          <Axis minutes={minutes} />
        </div>
      </div>
    </div>
  );
}

/**
 * The Time section body: total-time cards, time per phase, and time per
 * question (pre and post separately). `filter` hides the other arm.
 */
export function TimeOverview({
  data,
  items,
  filter,
}: {
  data: Record<Arm, ArmTime>;
  /** All questions, for labels. */
  items: ItemStat[];
  filter: Arm | null;
}) {
  const arms: Arm[] = filter ? [filter] : ARMS.map((a) => a.key);
  // Time per question is a dropdown, closed by default (like Question details).
  const [questionsOpen, setQuestionsOpen] = useState(false);
  return (
    <>
      <p className="mt-1 text-sm text-[#5e5e57]">
        Median times for participants who finished every step.
      </p>

      <div className={`mt-6 grid gap-4 ${arms.length > 1 ? "md:grid-cols-2" : ""}`}>
        {arms.map((a) => (
          <TotalCard key={a} arm={a} t={data[a]} />
        ))}
      </div>

      <h3 className="mt-10 text-lg font-semibold text-stone-900">Time per phase</h3>
      <div className="mt-3">
        <PhaseCard arms={arms} data={data} />
      </div>

      <div className="mt-8">
        <Collapsible
          id="time-per-question"
          title="Time per question"
          meta={`${items.length} questions`}
          open={questionsOpen}
          onToggle={() => setQuestionsOpen((o) => !o)}
        >
          <p className="pt-4 text-[13px] text-[#5e5e57]">
            Bar = fastest to slowest, dot = median. Longest first.
          </p>
          <div className="mt-3">
            <QuestionTimeCard items={items} arms={arms} data={data} />
          </div>
        </Collapsible>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- data quality -- */

function CsvLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      download
      className="text-sm font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800"
    >
      {children}
    </a>
  );
}

/** Where an answer was given, in words: "post-test Q2.2", "screening Q5". */
function whereAnswered(step: string, qid: string): string {
  const id = qid.includes(":") ? qid.split(":").pop()! : qid;
  if (step === "pretest") return `pre-test Q${id}`;
  if (step === "posttest") return `post-test Q${id}`;
  if (step === "screening") return id === "q1a" ? "screening Q5" : `screening ${id}`;
  return [step, id].filter(Boolean).join(" ");
}

/** Plain-language "why" for one person who didn't continue past screening. */
function whyText(p: ScreeningPerson): string {
  if (p.outcome === "not-finished") return "Left after opening screening";
  const parts = p.failedItems.map((item) => {
    switch (item) {
      case "highest-math":
        return `Too advanced: highest math is ${p.highestMath || "Calculus II or beyond"}`;
      case "calculus-courses":
        return `Too advanced: ${p.calculusCourses || "3 or more"} calculus courses`;
      case "algebra_check":
        return "Not ready: algebra check wrong";
      case "power_rule_check":
        return "Not ready: power-rule check wrong";
      case "q1a":
        return `Possible AI use: ${p.q5PastedChars} characters pasted into one answer, ${p.q5Keystrokes} ${
          p.q5Keystrokes === 1 ? "key" : "keys"
        } pressed`;
      default:
        return item;
    }
  });
  return parts.length ? parts.join(" · ") : p.reasons.join(" · ") || "Screened out";
}

const REASON_CARDS: { group: "high" | "low" | "ai"; title: string; subtitle: string; checks: { item: string; label: string }[] }[] = [
  {
    group: "high",
    title: "Too advanced",
    subtitle: "Above the ceiling",
    checks: [
      { item: "highest-math", label: "Calculus II or beyond" },
      { item: "calculus-courses", label: "3+ calculus courses" },
    ],
  },
  {
    group: "low",
    title: "Not ready",
    subtitle: "Below the floor",
    checks: [
      { item: "algebra_check", label: "Algebra check wrong" },
      { item: "power_rule_check", label: "Power-rule check wrong" },
    ],
  },
  {
    group: "ai",
    title: "Possible AI use",
    subtitle: "Pasted into a screening answer",
    // The paste check reads screening Q5 (item q1a): the worked optimization
    // problem, i.e. the Q1a of the participant's pre-test version.
    checks: [{ item: "q1a", label: "Pasted the worked-problem answer (Q5)" }],
  },
];

const GREY_BAR = "#b9b9b2";

function FunnelRow({
  label,
  total,
  base,
  split,
}: {
  label: string;
  total: number;
  base: number;
  /** Per-arm counts; the rest of `total` (no arm yet) is drawn grey. */
  split?: Record<Arm, number>;
}) {
  const w = (n: number) => `${base ? (n / base) * 100 : 0}%`;
  const unassigned = split ? Math.max(0, total - split.agent - split.lesson) : total;
  return (
    <div className="grid grid-cols-[170px_minmax(0,1fr)_40px] items-center gap-4">
      <span className="text-[15px] text-stone-900">{label}</span>
      <div className="flex h-7 overflow-hidden rounded-md bg-[#f1f1ee]">
        {split &&
          ARMS.map((a) =>
            split[a.key] > 0 ? (
              <div
                key={a.key}
                title={`${a.label}: ${split[a.key]}`}
                style={{ width: w(split[a.key]), background: a.color }}
              />
            ) : null
          )}
        {unassigned > 0 && (
          <div
            title={split ? `No arm yet: ${unassigned}` : `${total}`}
            style={{ width: w(unassigned), background: GREY_BAR }}
          />
        )}
      </div>
      <span className="text-right text-lg font-bold text-stone-900">{total}</span>
    </div>
  );
}

function SplitLegend({ split, total }: { split: Record<Arm, number>; total: number }) {
  const unassigned = Math.max(0, total - split.agent - split.lesson);
  return (
    <div className="ml-[186px] mt-1.5 flex flex-wrap gap-4 text-[13px] text-[#5e5e57]">
      {ARMS.map((a) => (
        <span key={a.key} className="inline-flex items-center gap-1.5">
          <Swatch arm={a.key} className="h-2.5 w-2.5" />
          {a.label} <span className="font-semibold text-stone-900">{split[a.key]}</span>
        </span>
      ))}
      {unassigned > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GREY_BAR }} />
          No arm yet <span className="font-semibold text-stone-900">{unassigned}</span>
        </span>
      )}
    </div>
  );
}

function DropNote({ children }: { children: ReactNode }) {
  return <p className="ml-[186px] mt-1.5 text-[13px] text-[#5e5e57]">↳ {children}</p>;
}

/**
 * The Data quality section body. Screening covers everyone who opened it;
 * AI-use flags cover eligible participants only, limited to `filter`'s arm.
 */
export function DataQuality({
  outcomes,
  aiCheck,
  completed,
  filter,
  screeningHref,
  flaggedHref,
}: {
  /** screening.csv, and answers.csv limited to eligible participants' flagged answers. */
  screeningHref: string;
  flaggedHref: string;
  outcomes: ScreeningOutcomes;
  /** Keystroke check over the section's arm (or everyone). */
  aiCheck: AiCheck;
  /** Full-flow completers, in total and per arm. */
  completed: { total: number } & Record<Arm, number>;
  filter: Arm | null;
}) {
  const [whoOpen, setWhoOpen] = useState(false);
  const people = outcomes.people;
  const eligible = people.filter((p) => p.outcome === "eligible");
  const eligibleSplit: Record<Arm, number> = {
    agent: eligible.filter((p) => p.arm === "agent").length,
    lesson: eligible.filter((p) => p.arm === "lesson").length,
  };
  const out = people.filter((p) => p.outcome === "screened-out");
  const notContinued = people.filter((p) => p.outcome !== "eligible");
  const notFinishedN = outcomes.started - outcomes.finished;

  // AI-use flags: eligible participants only (anyone screened out — including
  // for pasting — is excluded), and only those actually flagged.
  const eligibleIds = new Set(eligible.map((p) => p.subjectId));
  const armOf = new Map(people.map((p) => [p.subjectId, p.arm]));
  const checked = aiCheck.people.filter((p) => eligibleIds.has(p.subjectId));
  const flaggedAnswers = aiCheck.flagged.filter((a) => eligibleIds.has(a.subjectId));
  const flaggedPeople = [...new Set(flaggedAnswers.map((a) => a.subjectId))].map((id) => ({
    id,
    answers: flaggedAnswers.filter((a) => a.subjectId === id),
  }));
  const answersChecked = checked.reduce((s, p) => s + p.answers, 0);

  return (
    <>
      {/* ---------------------------------------------------- Screening */}
      <div id="screening" className="mt-6 scroll-mt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Screening</h3>
            <p className="mt-0.5 text-sm text-[#5e5e57]">
              Everyone who opened screening, and how many made it through.
            </p>
          </div>
          {people.length > 0 && (
            <CsvLink href={screeningHref}>Download CSV</CsvLink>
          )}
        </div>
        {filter && (
          <p className="mt-2 text-[13px] text-[#5e5e57]">
            Screening always covers everyone: arms are assigned when instruction
            starts, so people who stopped earlier have none.
          </p>
        )}

        <div className={`${CARD} mt-4 p-6`}>
          <FunnelRow label="Opened screening" total={outcomes.started} base={outcomes.started} />
          {notFinishedN > 0 && <DropNote>{notFinishedN} did not finish screening</DropNote>}
          <div className="mt-4">
            <FunnelRow label="Finished screening" total={outcomes.finished} base={outcomes.started} />
          </div>
          {out.length > 0 && <DropNote>{out.length} screened out</DropNote>}
          <div className="mt-4">
            <FunnelRow
              label="Eligible"
              total={eligible.length}
              base={outcomes.started}
              split={eligibleSplit}
            />
            <SplitLegend split={eligibleSplit} total={eligible.length} />
          </div>
          <div className="mt-4">
            <FunnelRow
              label="Completed the study"
              total={completed.total}
              base={outcomes.started}
              split={{ agent: completed.agent, lesson: completed.lesson }}
            />
            <SplitLegend
              split={{ agent: completed.agent, lesson: completed.lesson }}
              total={completed.total}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {REASON_CARDS.map((card) => (
            <div key={card.group} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-stone-900">{card.title}</p>
                  <p className="mt-0.5 text-[13px] text-[#5e5e57]">{card.subtitle}</p>
                </div>
                <span className="text-[28px] font-bold leading-none text-stone-900">
                  {out.filter((p) => p.groups.includes(card.group)).length}
                </span>
              </div>
              <div className="mt-3 space-y-1 border-t border-[#ecece8] pt-3">
                {card.checks.map((c) => (
                  <div key={c.item} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-stone-800">{c.label}</span>
                    <span className="text-stone-900">
                      {out.filter((p) => p.failedItems.includes(c.item)).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[#5e5e57]">
          One person can fail several checks, so groups can add up to more than the
          number screened out.
        </p>

        <div className="mt-4">
          <Collapsible
            id="who-didnt-continue"
            title="Who didn't continue"
            meta={`${notContinued.length} ${notContinued.length === 1 ? "person" : "people"}`}
            open={whoOpen}
            onToggle={() => setWhoOpen((o) => !o)}
          >
            {notContinued.length === 0 ? (
              <p className="pt-4 text-sm text-[#5e5e57]">Everyone who opened screening passed it.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#fafaf8] text-[12px] text-[#5e5e57]">
                      <th className="px-5 py-2.5 font-semibold">Participant</th>
                      <th className="px-3 py-2.5 font-semibold">Arm</th>
                      <th className="px-3 py-2.5 font-semibold">Outcome</th>
                      <th className="px-5 py-2.5 font-semibold">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notContinued.map((p) => (
                      <tr key={p.subjectId} className="border-t border-[#ecece8] align-top">
                        <td className="px-5 py-3 font-mono text-[13px] text-stone-900">{p.subjectId}</td>
                        <td className="px-3 py-3 text-stone-700">{armLabel(p.arm)}</td>
                        <td className="px-3 py-3">
                          {p.outcome === "screened-out" ? (
                            <span className="whitespace-nowrap rounded-full bg-[#f1e3e3] px-2.5 py-0.5 text-[13px] font-medium text-[#8a2b2b]">
                              Screened out
                            </span>
                          ) : (
                            <span className="whitespace-nowrap rounded-full bg-[#ecebe6] px-2.5 py-0.5 text-[13px] font-medium text-stone-700">
                              Did not finish
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-stone-800">{whyText(p)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapsible>
        </div>
      </div>

      {/* ---------------------------------------------------- AI-use flags */}
      <div id="ai-flags" className="mt-10 scroll-mt-6">
        <h3 className="text-lg font-semibold text-stone-900">AI-use flags</h3>
        <p className="mt-0.5 text-sm text-[#5e5e57]">
          Eligible participants only. An answer is flagged if it has more than one
          paste, or more characters than keys pressed.
        </p>
        <div className="mt-1">
          <CsvLink href={flaggedHref}>Download flagged answers (CSV)</CsvLink>
        </div>

        {flaggedPeople.length === 0 ? (
          <div className={`${CARD} mt-4 flex items-center gap-4 p-6`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
              <CheckIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-stone-900">
                No flags among eligible participants
              </p>
              <p className="text-sm text-[#5e5e57]">
                {answersChecked} {answersChecked === 1 ? "answer" : "answers"} checked from{" "}
                {checked.length} {checked.length === 1 ? "participant" : "participants"}.
              </p>
            </div>
          </div>
        ) : (
          <div className={`${CARD} mt-4 overflow-x-auto`}>
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="text-[12px] text-[#5e5e57]">
                  <th className="px-5 py-2.5 font-semibold">Participant</th>
                  <th className="px-3 py-2.5 font-semibold">Arm</th>
                  <th className="px-5 py-2.5 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {flaggedPeople.map(({ id, answers }) => {
                  const reasons = answers.map((a) => {
                    const where = whereAnswered(a.step, a.qid);
                    return a.flagPaste
                      ? `${a.pastes} pastes in ${where}`
                      : `More characters than keys in ${where} (${a.chars} vs ${a.keypresses + a.keypadChars})`;
                  });
                  return (
                    <tr key={id} className="border-t border-[#ecece8] align-top">
                      <td className="px-5 py-3 font-mono text-[13px] text-stone-900">{id}</td>
                      <td className="px-3 py-3">
                        <ArmTag arm={armOf.get(id) ?? null} />
                      </td>
                      <td className="px-5 py-3 text-stone-800">
                        {answers.length > 1 && (
                          <span className="font-semibold">{answers.length} answers flagged · </span>
                        )}
                        {reasons.join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- surveys -- */

/** One arm's completer survey summaries (null when the arm has no completers). */
export type ArmSurveys = { pre: SurveyItemSummary[]; post: SurveyItemSummary[] } | null;

/** Shorter headings for the background questions. */
const SHORT_PROMPTS: Record<string, string> = {
  age: "Age",
  education: "Highest education completed",
  field: "Primary field of study or work",
  "home-language": "Language(s) spoken at home · select all that apply",
  "learned-real-world": "Learned real-world uses of calculus in a course",
  "used-real-world": "Personally used calculus on a real-world problem",
  "ai-frequency": "How often they use AI tools for learning",
};

const ARM_PILL: Record<Arm, { bg: string; ink: string }> = {
  agent: { bg: "#fbe9d6", ink: "#8a4a0c" },
  lesson: { bg: "#e3ebf8", ink: "#1f4a94" },
};

const rating = (v: number) => v.toFixed(1);
const ratingChange = (d: number) => {
  const r = Math.round(d * 10) / 10;
  return r === 0 ? "0" : `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
};
/** Position on a 1–7 track. */
const onScale = (v: number, max = 7) => `${((v - 1) / (max - 1)) * 100}%`;

function surveyGrid(arms: Arm[]) {
  return arms.length > 1
    ? "grid grid-cols-[minmax(0,1fr)_210px_210px] gap-x-7"
    : "grid grid-cols-[minmax(0,1fr)_210px] gap-x-7";
}

function ArmHeaderRow({ arms, grid }: { arms: Arm[]; grid: string }) {
  return (
    <div className={`${grid} border-b border-[#f2f2ee] pb-2 text-[13px] font-semibold text-[#5e5e57]`}>
      <span />
      {arms.map((a) => (
        <span key={a} className="inline-flex items-center gap-2">
          <Swatch arm={a} className="h-2.5 w-2.5" />
          {armMeta(a).label}
        </span>
      ))}
    </div>
  );
}

function GroupLabel({ first, children }: { first?: boolean; children: ReactNode }) {
  return (
    <p
      className={`pb-1 text-[12px] font-semibold uppercase tracking-wider text-[#6b6b63] ${
        first ? "pt-4" : "mt-2 border-t border-[#d6d6d0] pt-6"
      }`}
    >
      {children}
    </p>
  );
}

const itemFor = (s: SurveyItemSummary[] | undefined, id: string) => s?.find((i) => i.id === id);

function AttitudeCell({ arm, pre, post }: { arm: Arm; pre?: number | null; post?: number | null }) {
  if (pre == null || post == null) return <span className="text-stone-400">—</span>;
  const color = armMeta(arm).color;
  const lo = Math.min(pre, post);
  const hi = Math.max(pre, post);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-[#5e5e57]">
          {rating(pre)} → {rating(post)}
        </span>
        <span className="font-bold text-stone-900">{ratingChange(post - pre)}</span>
      </div>
      <div className="relative mx-1.5 mt-2 h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e1e1dc]" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
          style={{ left: onScale(lo), width: `calc(${onScale(hi)} - ${onScale(lo)})`, background: color }}
        />
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
          style={{ left: onScale(pre), borderColor: color }}
        />
        <span
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: onScale(post), background: color }}
        />
      </div>
    </div>
  );
}

function MedianDotCell({ arm, item }: { arm: Arm; item?: SurveyItemSummary }) {
  const m = item?.likertMedian;
  const max = item?.likertMax ?? 7;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2">
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#e1e1dc]" />
        {m != null && (
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: onScale(m, max), background: armMeta(arm).color }}
          />
        )}
      </div>
      <span className="text-right text-[13px] font-semibold text-stone-900">
        {m == null ? "—" : rating(m)}
      </span>
    </div>
  );
}

function MedianRows({
  ids,
  which,
  arms,
  data,
  grid,
}: {
  ids: string[];
  which: "pre" | "post";
  arms: Arm[];
  data: Record<Arm, ArmSurveys>;
  grid: string;
}) {
  return (
    <>
      {ids.map((id) => {
        const prompt = arms.map((a) => itemFor(data[a]?.[which], id)?.prompt).find(Boolean) ?? id;
        return (
          <div key={id} className={`${grid} items-center border-b border-[#f2f2ee] py-3 last:border-b-0`}>
            <span className="text-[14px] text-stone-900">{prompt}</span>
            {arms.map((a) => (
              <MedianDotCell key={a} arm={a} item={itemFor(data[a]?.[which], id)} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function ChoiceQuestion({
  id,
  arms,
  data,
  grid,
}: {
  id: string;
  arms: Arm[];
  data: Record<Arm, ArmSurveys>;
  grid: string;
}) {
  const [all, setAll] = useState(false);
  const items = Object.fromEntries(arms.map((a) => [a, itemFor(data[a]?.pre, id)])) as Record<
    Arm,
    SurveyItemSummary | undefined
  >;
  const any = arms.map((a) => items[a]).find(Boolean);
  if (!any) return null;
  const labels = (any.choices ?? []).map((c) => c.label);
  const countOf = (a: Arm, label: string) =>
    items[a]?.choices?.find((c) => c.label === label)?.count ?? 0;
  const chosen = labels.filter((l) => arms.some((a) => countOf(a, l) > 0));
  const shown = all ? labels : chosen;
  const hidden = labels.length - chosen.length;

  return (
    <div className="border-b border-[#f2f2ee] py-3 last:border-b-0">
      <p className="text-[14px] font-semibold text-stone-900">
        {SHORT_PROMPTS[id] ?? any.prompt}
      </p>
      <div className="mt-1 space-y-1">
        {shown.map((label) => (
          <div key={label} className={`${grid} items-center`}>
            <span className="text-[14px] text-stone-800">{label}</span>
            {arms.map((a) => {
              const item = items[a];
              const n = item?.n ?? 0;
              const c = countOf(a, label);
              return (
                <div key={a} className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-2">
                  <div className="h-2 rounded-full bg-[#f1f1ee]">
                    {n > 0 && c > 0 && (
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${(c / n) * 100}%`, background: armMeta(a).color }}
                      />
                    )}
                  </div>
                  <span className="text-right text-[13px] text-stone-900">{n > 0 ? c : "—"}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <p className="mt-1.5 text-[12px] text-[#5e5e57]">
          {all ? (
            <button
              type="button"
              onClick={() => setAll(false)}
              className="font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800"
            >
              Show only chosen options
            </button>
          ) : (
            <>
              + {hidden} {hidden === 1 ? "option" : "options"} with no answers ·{" "}
              <button
                type="button"
                onClick={() => setAll(true)}
                className="font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800"
              >
                Show all
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function OpenQuestion({ id, arms, data }: { id: string; arms: Arm[]; data: Record<Arm, ArmSurveys> }) {
  const [all, setAll] = useState(false);
  const prompt = arms.map((a) => itemFor(data[a]?.post, id)?.prompt).find(Boolean) ?? id;
  const answers = arms
    .flatMap((a) =>
      (itemFor(data[a]?.post, id)?.responses ?? [])
        .filter((r) => r.text.trim())
        .map((r) => ({ ...r, arm: a }))
    )
    .sort((x, y) => y.at.localeCompare(x.at));
  const shown = all ? answers : answers.slice(0, 3);
  return (
    <div className="border-b border-[#f2f2ee] py-3 last:border-b-0">
      <p className="text-[14px] text-stone-900">
        <span className="font-semibold">{prompt}</span>
        <span className="text-[#5e5e57]">
          {" "}
          · {answers.length} {answers.length === 1 ? "answer" : "answers"}
        </span>
      </p>
      <div className="mt-2 space-y-2">
        {shown.map((r, i) => (
          <div key={i} className="flex items-start gap-3 rounded-[10px] bg-[#f7f7f4] px-4 py-2.5">
            <span
              className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold"
              style={{ background: ARM_PILL[r.arm].bg, color: ARM_PILL[r.arm].ink }}
            >
              {armMeta(r.arm).label}
            </span>
            <span className="text-[14px] text-stone-800">“{r.text.trim()}”</span>
          </div>
        ))}
      </div>
      {answers.length > 3 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2 text-[13px] font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800"
        >
          {all ? "Show fewer" : `Show all ${answers.length}`}
        </button>
      )}
    </div>
  );
}

/**
 * The Surveys section body: attitudes before → after (questions in both
 * surveys), then the pre- and post-survey dropdowns. Medians throughout;
 * `filter` hides the other arm's column.
 */
export function SurveysOverview({
  data,
  filter,
  preOpen,
  postOpen,
  onTogglePre,
  onTogglePost,
}: {
  data: Record<Arm, ArmSurveys>;
  filter: Arm | null;
  preOpen: boolean;
  postOpen: boolean;
  onTogglePre: () => void;
  onTogglePost: () => void;
}) {
  const arms: Arm[] = filter ? [filter] : ARMS.map((a) => a.key);
  const grid = surveyGrid(arms);

  // Question ids by kind, from whichever arm has data.
  const anyArm = ARMS.map((a) => data[a.key]).find(Boolean);
  const pre = anyArm?.pre ?? [];
  const post = anyArm?.post ?? [];
  const postIds = new Set(post.map((i) => i.id));
  const paired = pre.filter((i) => i.kind === "likert" && postIds.has(i.id)).map((i) => i.id);
  const pairedSet = new Set(paired);
  const preChoice = pre.filter((i) => i.kind === "choice" || i.kind === "multi").map((i) => i.id);
  const preLikert = pre.filter((i) => i.kind === "likert" && !pairedSet.has(i.id)).map((i) => i.id);
  const postLikert = post.filter((i) => i.kind === "likert" && !pairedSet.has(i.id)).map((i) => i.id);
  const postOpenIds = post.filter((i) => i.kind === "open").map((i) => i.id);

  return (
    <>
      <p className="mt-1 text-sm text-[#5e5e57]">
        Ratings on a 1–7 scale, shown as medians. Completers only.
      </p>

      {!anyArm ? (
        <p className="mt-4 text-sm text-[#5e5e57]">No completers yet</p>
      ) : (
        <>
          <div className={`${CARD} mt-5 overflow-x-auto px-6 py-5`}>
            <div className="min-w-[620px]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">Attitudes before → after</h3>
                  <p className="mt-0.5 text-[13px] text-[#5e5e57]">
                    The {paired.length} questions asked in both surveys · median rating.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[13px] text-[#5e5e57]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-stone-500" /> Pre-survey
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-stone-500" /> Post-survey
                  </span>
                </div>
              </div>
              <div className={`${grid} mt-4 border-b border-[#f2f2ee] pb-2 text-[13px] font-semibold text-[#5e5e57]`}>
                <span>Question</span>
                {arms.map((a) => (
                  <span key={a} className="inline-flex items-center gap-2">
                    <Swatch arm={a} className="h-2.5 w-2.5" />
                    {armMeta(a).label}
                  </span>
                ))}
              </div>
              {paired.map((id) => {
                const prompt = itemFor(pre, id)?.prompt ?? id;
                return (
                  <div key={id} className={`${grid} items-center border-b border-[#f2f2ee] py-3.5 last:border-b-0`}>
                    <span className="text-[14px] text-stone-900">{prompt}</span>
                    {arms.map((a) => (
                      <AttitudeCell
                        key={a}
                        arm={a}
                        pre={itemFor(data[a]?.pre, id)?.likertMedian}
                        post={itemFor(data[a]?.post, id)?.likertMedian}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Collapsible
              id="pre-survey"
              title="Pre-survey"
              meta="participant background and motivation"
              open={preOpen}
              onToggle={onTogglePre}
            >
              <div className="overflow-x-auto pt-4">
                <div className="min-w-[620px]">
                  <ArmHeaderRow arms={arms} grid={grid} />
                  <GroupLabel first>About the participants</GroupLabel>
                  {preChoice.map((id) => (
                    <ChoiceQuestion key={id} id={id} arms={arms} data={data} grid={grid} />
                  ))}
                  {preLikert.length > 0 && (
                    <>
                      <GroupLabel>Motivation · median rating</GroupLabel>
                      <MedianRows ids={preLikert} which="pre" arms={arms} data={data} grid={grid} />
                    </>
                  )}
                </div>
              </div>
            </Collapsible>

            <Collapsible
              id="post-survey"
              title="Post-survey"
              meta="views on the instruction and open feedback"
              open={postOpen}
              onToggle={onTogglePost}
            >
              <div className="overflow-x-auto pt-4">
                <div className="min-w-[620px]">
                  <ArmHeaderRow arms={arms} grid={grid} />
                  {postLikert.length > 0 && (
                    <>
                      <GroupLabel first>About the instruction · median rating</GroupLabel>
                      <MedianRows ids={postLikert} which="post" arms={arms} data={data} grid={grid} />
                    </>
                  )}
                  {postOpenIds.length > 0 && (
                    <>
                      <GroupLabel first={postLikert.length === 0}>Open-ended feedback</GroupLabel>
                      {postOpenIds.map((id) => (
                        <OpenQuestion key={id} id={id} arms={arms} data={data} />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </Collapsible>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------------------------------------------------- participants -- */

type ResponseRow = { itemId: string; label: string; answer: string; points: number | null; maxPoints: number };

/** One completer, as the Participants list needs it. */
export type ParticipantRow = {
  id: string;
  arm: string | null;
  pre: number | null;
  post: number | null;
  max: number | null;
  totalMin: number | null;
  preSurvey: { label: string; value: string }[];
  postSurvey: { label: string; value: string }[];
  preTest: ResponseRow[];
  postTest: ResponseRow[];
  instruction: { id: string; name: string; answer: string }[];
};

const TABS = ["Pre-survey", "Pre-test", "Instruction", "Post-test", "Post-survey"] as const;
type Tab = (typeof TABS)[number];

function ScorePill({ points, max }: { points: number | null; max: number }) {
  const style =
    points == null
      ? { background: "#ecebe6", color: "#5e5e57" }
      : points >= max
        ? { background: "#eef5e2", color: "#2c4d07" }
        : points <= 0
          ? { background: "#f1e3e3", color: "#8a2b2b" }
          : { background: "#fbf1c2", color: "#5c4a00" };
  return (
    <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={style}>
      {points == null ? "—" : points}/{max}
    </span>
  );
}

function AnswerRows({
  rows,
}: {
  rows: { key: string; id?: string; name: string; answer: string; pill?: ReactNode }[];
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-4 text-sm text-[#5e5e57]">Nothing recorded for this step.</p>;
  }
  return (
    <>
      {rows.map((r) => (
        <div
          key={r.key}
          className="grid grid-cols-[minmax(0,210px)_minmax(0,1fr)_auto] items-start gap-4 border-b border-[#f2f2ee] px-5 py-3 last:border-b-0"
        >
          <span className="text-[14px] text-stone-900">
            {r.id && <span className="font-bold">{r.id} </span>}
            <MathDisplay className="inline" text={r.name} />
          </span>
          {/* Answers and prompts can contain \( … \) math; keep line breaks. */}
          <MathDisplay
            className="whitespace-pre-wrap break-words text-[14px] text-stone-700"
            text={r.answer || "—"}
          />
          <span>{r.pill}</span>
        </div>
      ))}
    </>
  );
}

function ParticipantDetailView({ p }: { p: ParticipantRow }) {
  const [tab, setTab] = useState<Tab>("Post-test");
  const testRows = (rows: ResponseRow[]) =>
    rows.map((r) => {
      const { id, name } = parseItemLabel(r.label);
      return {
        key: r.itemId,
        id,
        name,
        answer: r.answer,
        pill: <ScorePill points={r.points} max={r.maxPoints} />,
      };
    });
  const surveyRows = (lines: { label: string; value: string }[]) =>
    lines.map((l, i) => ({ key: `${i}`, name: l.label, answer: l.value }));
  const rows =
    tab === "Pre-survey"
      ? surveyRows(p.preSurvey)
      : tab === "Post-survey"
        ? surveyRows(p.postSurvey)
        : tab === "Pre-test"
          ? testRows(p.preTest)
          : tab === "Post-test"
            ? testRows(p.postTest)
            : p.instruction.map((r, i) => ({ key: `${i}`, id: r.id, name: r.name, answer: r.answer }));

  return (
    <div className="bg-[#fafaf8] px-5 pb-5 pt-4">
      <div role="tablist" aria-label="Step" className="inline-flex flex-wrap rounded-xl bg-[#ecebe6] p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
              tab === t ? "bg-white font-semibold text-stone-900 shadow-sm" : "text-stone-700 hover:text-stone-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" className={`${CARD} mt-4`}>
        <AnswerRows rows={rows} />
      </div>
    </div>
  );
}

const P_GRID = "grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_24px] items-center gap-4";

/**
 * Everyone who finished the study: one row each (ID, arm, total pre → post,
 * total time). A row opens inline to that participant's answers, step by step.
 */
export function ParticipantsList({ people }: { people: ParticipantRow[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = [...people]
    .filter((p) => !q || p.id.toLowerCase().includes(q))
    .sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <p className="mt-1 text-sm text-[#5e5e57]">
        Everyone who finished the study. Open a participant to see their answers.
      </p>
      <label className="relative mt-4 block max-w-[360px]">
        <span className="sr-only">Search by participant ID</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e5e57]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by participant ID"
          className="h-11 w-full rounded-[10px] border border-[#e1e1dc] bg-white pl-10 pr-3 text-sm text-stone-900 focus:border-lime-600 focus:outline-none"
        />
      </label>

      <div className={`${CARD} mt-4 overflow-x-auto`}>
        <div className="min-w-[640px]">
          <div className={`${P_GRID} rounded-t-[14px] bg-[#fafaf8] px-5 py-3 text-[13px] font-semibold text-[#5e5e57]`}>
            <span>Participant</span>
            <span>Arm</span>
            <span>Total score (pre → post)</span>
            <span>Time</span>
            <span />
          </div>
          {shown.length === 0 ? (
            <p className="border-t border-[#ecece8] px-5 py-4 text-sm text-[#5e5e57]">
              {people.length === 0 ? "No completers yet" : "No participant matches that ID."}
            </p>
          ) : (
            shown.map((p) => {
              const isOpen = open === p.id;
              const gain = p.pre != null && p.post != null ? p.post - p.pre : null;
              return (
                <div key={p.id} className="border-t border-[#ecece8]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : p.id)}
                    className={`${P_GRID} w-full px-5 py-4 text-left hover:bg-[#fafaf8] ${isOpen ? "bg-[#fafaf8]" : ""}`}
                  >
                    <span className="font-mono text-[14px] font-bold text-stone-900">{p.id}</span>
                    <span>
                      <ArmTag arm={p.arm} />
                    </span>
                    <span className="text-[14px] text-stone-800">
                      {p.pre != null && p.post != null ? (
                        <>
                          {p.pre} → {p.post} / {p.max}
                          <span className="ml-2 font-bold text-stone-900">
                            {gain === 0 ? "0" : `${gain! > 0 ? "+" : "−"}${Math.abs(gain!)}`}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-[14px] text-stone-800">
                      {p.totalMin == null ? "—" : `${Math.round(p.totalMin)} min`}
                    </span>
                    <ChevronDownIcon
                      className={`h-4 w-4 text-stone-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && <ParticipantDetailView p={p} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- downloads -- */

const DOWNLOAD_CARDS: { format: string; name: string; row: string; summary: string }[] = [
  {
    format: "participants",
    name: "Participants",
    row: "One row per completer",
    summary:
      "Arm, test version, demographics, survey ratings, pre/post scores by skill, gains, phase times, AI-flag yes/no.",
  },
  {
    format: "answers",
    name: "Answers",
    row: "One row per answer",
    summary:
      "Each participant × question × test: score, time, rubric points, paste and keystroke counts, flagged, answer text.",
  },
  {
    format: "screening",
    name: "Screening",
    row: "One row per person screened",
    summary:
      "Everyone who opened screening: arm, outcome, every check result, and their Q1a score and criteria.",
  },
];

/** The three study CSVs as cards, the two extras as links, and when it was generated. */
export function DownloadsPanel({
  hrefFor,
  generatedAt,
}: {
  hrefFor: (format: string) => string;
  generatedAt: string;
}) {
  return (
    <>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {DOWNLOAD_CARDS.map((c) => (
          <a
            key={c.format}
            href={hrefFor(c.format)}
            download
            className={`${CARD} block p-5 transition-colors hover:border-lime-600`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[17px] font-semibold text-stone-900">
                {c.name} <span className="text-[12px] font-medium text-[#6b6b63]">CSV</span>
              </p>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#eef5e2] text-lime-700">
                <DownloadIcon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-[14px] text-[#3d3d38]">{c.row}</p>
            <p className="mt-2 text-[13px] leading-5 text-[#5e5e57]">{c.summary}</p>
          </a>
        ))}
      </div>
      <p className="mt-4 text-sm text-[#5e5e57]">
        More:{" "}
        <a href={hrefFor("json")} download className="ml-2 font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800">
          Full results (JSON)
        </a>
        <a href={hrefFor("events")} download className="ml-4 font-medium text-lime-700 underline underline-offset-2 hover:text-lime-800">
          Raw event log (CSV)
        </a>
      </p>
      <p className="mt-3 text-xs text-[#6b6b63]">Generated {new Date(generatedAt).toLocaleString()}</p>
    </>
  );
}
