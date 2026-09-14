import Link from "next/link";
import {
  ArrowRightIcon,
  Pencil2Icon,
} from "@radix-ui/react-icons";
import AppHeader from "@/components/app-header";
import { PREVIEW_PHASES, previewHref } from "@/lib/preview";

const instructorTools = [
  {
    href: "/instructor/generate",
    title: "Generate instruction set",
    description:
      "Create a new calculus teaching module, from the student task through its grading materials.",
    icon: Pencil2Icon,
  },
];

export default function InstructorDashboardPage() {
  return (
    <main className="flex min-h-screen flex-col bg-stone-100">
      <AppHeader />

      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-wider text-lime-700">
          Instructor workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-800">
          Preview the study
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-6 text-stone-500">
          Open any phase on its own — the participant flow runs strictly in
          order, so this is the only way to reach a later page without
          completing everything before it. Tests and surveys step through
          without answering; the instructions stay fully interactive so the AI
          conversation can be tested.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_PHASES.map((phase) => (
            <Link
              key={phase.id}
              href={previewHref(phase.path)}
              className="group flex flex-col rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-lime-600 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600"
            >
              <span className="text-lg font-bold text-stone-800">
                {phase.label}
              </span>
              <span className="mt-2 flex-1 text-sm leading-6 text-stone-500">
                {phase.description}
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-lime-700">
                Open
                <ArrowRightIcon
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold text-stone-800">
          Teaching materials
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-6 text-stone-500">
          Build and edit the teaching modules behind the scenarios.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {instructorTools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex min-h-48 flex-col rounded-2xl border-2 border-stone-200 bg-white p-6 shadow-sm transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-lime-600 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-100 text-lime-700">
                  <Icon width={21} height={21} aria-hidden="true" />
                </span>
                <span className="mt-5 text-lg font-bold text-stone-800">
                  {tool.title}
                </span>
                <span className="mt-2 flex-1 text-sm leading-6 text-stone-500">
                  {tool.description}
                </span>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-lime-700">
                  Open
                  <ArrowRightIcon
                    width={16}
                    height={16}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>

      </div>
    </main>
  );
}
