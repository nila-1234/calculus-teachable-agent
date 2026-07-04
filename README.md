# Calculus Teachable Agent

A Next.js app that puts the user in the role of a first-week calculus TA. Instead of just answering calculus questions, the user helps *build* the assessment: picking the right model for a real-world scenario, writing a grading rubric, and then applying that rubric to grade AI-generated student answers. The goal is to teach calculus concepts through the act of authoring and grading, not just solving.

## How it works

Each scenario (e.g. "Company Profit Analysis", "Water Reservoir Levels", "Machine Risk Scores") walks through three steps:

1. **Create the question** ([app/[id]/question](app/%5Bid%5D/question/page.tsx)) — Pick the function that correctly models the scenario and finish composing the question students will see. A scatter plot of the underlying data ([components/scatter-plot.tsx](components/scatter-plot.tsx)) is shown alongside the scenario to help judge which model fits.
2. **Create the rubric** ([app/[id]/create-rubric](app/%5Bid%5D/create-rubric/page.tsx)) — Decide which grading criteria should be included in the rubric for the question just authored.
3. **Apply the rubric** ([app/[id]/apply-rubric](app/%5Bid%5D/apply-rubric/page.tsx)) — Use the rubric to grade a set of AI-generated student answers, marking each criterion as pass/fail.

Scenario content (scenario text, question parts/choices, plot data, rubric options, sample/AI-generated answers) is defined per-scenario in [lib/scenarios/registry.ts](lib/scenarios/registry.ts). Some steps have multiple "modes" (e.g. with/without LLM-generated feedback) selectable via the `questionMode` / `applyRubricMode` query params, useful for A/B-style comparisons.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router) + React 19
- [Radix UI Themes](https://www.radix-ui.com/themes) for UI components
- [Recharts](https://recharts.org/) for the scatter plots
- [KaTeX](https://katex.org/) / `react-katex` for math rendering
- An OpenAI-compatible LLM (via a LiteLLM proxy) for generating feedback and grading assistance (`lib/openai.ts`, `app/api/*`)

## Getting started

### Prerequisites

- Node.js 20+
- A MongoDB connection string (for logging)
- Access to an OpenAI-compatible endpoint (e.g. a LiteLLM proxy) for the AI feedback features

### Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root with:

   ```bash
   LITELLM_PROXY_URL=
   LITELLM_PROXY_KEY=
   LITELLM_DEFAULT_MODEL=
   MONGODB_URI=
   MONGODB_DB=
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and pick a scenario to start the TA flow.

### Other scripts

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

## Project structure

```
app/                  Routes (App Router): home page, per-scenario steps, API routes
components/           UI panels and shared components (scatter plot, math input/display, rubric panels, etc.)
lib/scenarios/        Scenario registry, types, and helpers
lib/                  Logger, LLM client, prompts, math helpers
```
