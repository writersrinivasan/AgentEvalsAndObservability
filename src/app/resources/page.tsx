import { SectionTitle } from "@/components/ui";

const GROUPS = [
  {
    title: "Build agents",
    color: "from-sky-500 to-indigo-500",
    links: [
      ["LangGraph.js documentation", "https://langchain-ai.github.io/langgraphjs/"],
      ["Anthropic: Building effective agents", "https://www.anthropic.com/research/building-effective-agents"],
      ["Claude API documentation", "https://docs.claude.com/"],
    ],
  },
  {
    title: "Observability",
    color: "from-amber-400 to-orange-500",
    links: [
      ["OpenTelemetry GenAI semantic conventions", "https://opentelemetry.io/docs/specs/semconv/gen-ai/"],
      ["LangSmith: tracing & observability", "https://docs.smith.langchain.com/observability"],
      ["Langfuse (open source)", "https://langfuse.com/docs"],
      ["Arize Phoenix (open source)", "https://docs.arize.com/phoenix"],
    ],
  },
  {
    title: "Evals",
    color: "from-emerald-400 to-teal-500",
    links: [
      ["Anthropic: Define success criteria & develop tests", "https://docs.claude.com/en/docs/test-and-evaluate/develop-tests"],
      ["LangSmith: evaluation concepts", "https://docs.smith.langchain.com/evaluation"],
      ["Hamel Husain: Your AI product needs evals", "https://hamel.dev/blog/posts/evals/"],
      ["promptfoo: evals & red-teaming in CI", "https://www.promptfoo.dev/docs/intro/"],
      ["Ragas: RAG & agent metrics", "https://docs.ragas.io/"],
      ["DeepEval", "https://docs.confident-ai.com/"],
    ],
  },
  {
    title: "LLM-as-a-judge & research",
    color: "from-violet-500 to-fuchsia-500",
    links: [
      ["Judging LLM-as-a-Judge with MT-Bench (Zheng et al.)", "https://arxiv.org/abs/2306.05685"],
      ["Hamel Husain: Creating an LLM-as-a-judge", "https://hamel.dev/blog/posts/llm-judge/"],
      ["Eugene Yan: Evaluating LLM-evaluators", "https://eugeneyan.com/writing/llm-evaluators/"],
      ["τ-bench: tool-agent-user interaction benchmark", "https://arxiv.org/abs/2406.12045"],
    ],
  },
  {
    title: "Safety & guardrails",
    color: "from-rose-500 to-pink-500",
    links: [["OWASP Top 10 for LLM applications", "https://genai.owasp.org/llm-top-10/"]],
  },
];

const GLOSSARY: [string, string][] = [
  ["Trace", "Full record of one request, a tree of spans sharing a trace id."],
  ["Span", "One timed unit of work (node, LLM call, tool call) with inputs, outputs and attributes."],
  ["Trajectory", "The ordered list of steps an agent took. Evaluate it, not just the final answer."],
  ["Golden dataset", "Curated inputs + expected behaviour, versioned with your code."],
  ["Code-based grader", "Deterministic function that scores a run: exact match, regex, state checks."],
  ["LLM-as-a-judge", "A model scoring outputs against a rubric. Needs calibration against humans."],
  ["Offline eval", "Run before deploy on a dataset with ground truth."],
  ["Online eval / detector", "Runs on live traffic, typically without ground truth."],
  ["Regression", "A case that passed in the baseline and fails now."],
  ["Quality gate", "CI step that blocks a deploy below a score threshold."],
  ["pass@k / pass^k", "Succeeds in at least one of k tries / in all k tries. Measures reliability under non-determinism."],
  ["Guardrail", "Code or model check that blocks/redacts unsafe inputs or outputs."],
  ["Drift", "Change in inputs, behaviour or metrics over time (new users, new model, new prompt)."],
];

export default function ResourcesPage() {
  return (
    <div>
      <SectionTitle eyebrow="Reference" title={<>Resources &amp; <span className="gradient-text">Cheat Sheet</span></>}>
        Everything participants need after the workshop: setup, curated reading and a glossary.
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-5">
          <div className="label mb-3">⚙️ Setup (for participants)</div>
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed text-emerald-200">{`git clone <workshop-repo> && cd AgentEvalsAndObservability
npm install

# Option A: offline simulator (no key, no cost, deterministic)
npm run dev                      # → http://localhost:3000

# Option B: live Claude
cp .env.example .env.local       # add ANTHROPIC_API_KEY
npm run dev

# Evals from the terminal (CI quality gate)
npm run eval -- v1 --mock
npm run eval -- v2 --mock        # exits 1: gate fails
npm run eval -- v3 --threshold 0.9

# Optional: also send traces to LangSmith (zero code changes)
LANGSMITH_TRACING=true LANGSMITH_API_KEY=... npm run dev`}</pre>
          <div className="label mb-2 mt-5">🗂 Project map</div>
          <div className="grid gap-1.5 text-xs">
            {[
              ["src/lib/agent/graph.ts", "LangGraph agent: state, nodes, edges, runAgent()"],
              ["src/lib/agent/tracer.ts", "Minimal OTel-style tracer"],
              ["src/lib/agent/llm.ts", "Claude calls (live) + offline simulator, token & cost accounting"],
              ["src/lib/agent/versions.ts", "v1 / v2 / v3 release flags"],
              ["src/lib/evals/dataset.ts", "Golden dataset (add your cases here!)"],
              ["src/lib/evals/evaluators.ts", "Code graders + LLM judge"],
              ["scripts/eval.ts", "CLI runner & CI gate"],
              ["src/content/curriculum.ts", "The 5-hour curriculum content"],
            ].map(([f, d]) => (
              <div key={f} className="flex gap-3 rounded-lg bg-white/[0.03] px-3 py-1.5">
                <code className="w-56 shrink-0 text-sky-300">{f}</code>
                <span className="text-muted">{d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="label mb-3">📖 Glossary</div>
          <dl className="space-y-2">
            {GLOSSARY.map(([t, d]) => (
              <div key={t} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <dt className="text-sm font-bold text-amber-200">{t}</dt>
                <dd className="text-xs text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="card overflow-hidden">
            <div className={`h-1.5 bg-gradient-to-r ${g.color}`} />
            <div className="p-5">
              <div className="mb-3 font-bold">{g.title}</div>
              <ul className="space-y-1.5">
                {g.links.map(([t, u]) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-ink">
                      ↗ {t}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
