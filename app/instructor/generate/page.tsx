import InstructionGeneratorWorkspace from "@/components/instructor/instruction-generator-workspace";
import AppHeader from "@/components/app-header";

export default function InstructorGeneratePage() {
  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <AppHeader />
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-7 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-700">
              Instructor workspace
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              Instruction generator
            </h1>
            <p className="mt-3 text-base leading-7 text-stone-600">
              Turn a calculus concept into a complete teaching module, inspect every
              pipeline stage, and refine the final student experience before export.
            </p>
          </div>
          <InstructionGeneratorWorkspace />
        </div>
      </div>
    </main>
  );
}
