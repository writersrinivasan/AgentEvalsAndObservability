// The 5-hour workshop (2 days × 2.5h). Every module follows the same rhythm:
//   ▶ DO FIRST (hands-on, no theory)  →  🔍 BREAK IT DOWN (name what you just saw)

export interface Concept {
  term: string;
  body: string;
}

export interface Module {
  id: string;
  day: 1 | 2;
  start: string; // offset within the day
  minutes: number;
  title: string;
  emoji: string;
  color: string; // tailwind gradient
  kind: "module" | "break";
  hook?: string;
  doFirst?: { step: string; link?: { href: string; label: string } }[];
  breakDown?: Concept[];
  codeRefs?: { file: string; why: string }[];
  discuss?: string[];
  quiz?: { q: string; options: string[]; answer: number; why: string };
  resources?: { title: string; url: string }[];
}

export const DAYS = {
  1: {
    title: "See it · Trace it · Break it",
    subtitle: "Observability: answer “WHY did my agent do that?”",
    color: "from-fuchsia-500 via-violet-500 to-sky-500",
  },
  2: {
    title: "Measure it · Prove it · Ship it",
    subtitle: "Evals: answer “Is it good? Is it BETTER than yesterday?”",
    color: "from-amber-400 via-orange-500 to-rose-500",
  },
} as const;

export const MODULES: Module[] = [
  // ───────────────────────────────── DAY 1 ─────────────────────────────────
  {
    id: "d1-m0",
    day: 1,
    start: "0:00",
    minutes: 15,
    title: "Kickoff: Is this agent actually good?",
    emoji: "🎬",
    color: "from-fuchsia-500 to-pink-500",
    kind: "module",
    hook: "No slides. We open a working support agent for ShopSmart and start using it in the first 2 minutes.",
    doFirst: [
      { step: "Open the Agent Lab. Click “📦 Order status”, “💸 Eligible refund” and “🎧 Product Q”.", link: { href: "/lab", label: "Open Agent Lab" } },
      { step: "Everyone votes: thumbs up or down. Is this agent good enough to put in front of 1 million customers?" },
      { step: "Now click “😡 Legal threat”. Still confident? Write down why or why not." },
    ],
    breakDown: [
      { term: "The “vibe check” trap", body: "Trying 3 prompts and saying “looks good” is how most agents ship. It doesn’t scale, isn’t repeatable, and can’t tell you whether a change made things better or worse." },
      { term: "Three questions every agent team must answer", body: "① Does it work? (evals) ② Why did it do that? (observability) ③ Will it keep working after the next change, model upgrade or traffic shift? (regression testing + monitoring)." },
      { term: "Why agents are harder than chatbots", body: "Agents take multiple steps, call tools, branch, and act in the world (issue refunds!). A correct-looking final answer can hide a wrong path, and a wrong path can cost real money." },
    ],
    discuss: ["What’s the most expensive mistake this agent could make for ShopSmart?", "Who in your organisation decides “good enough to ship”?"],
    quiz: {
      q: "Your agent answers 3 test questions perfectly. What do you actually know?",
      options: ["It is production-ready", "It works on those 3 questions, today, with this model and prompt", "It has no hallucinations", "Its refund decisions are policy-compliant"],
      answer: 1,
      why: "A handful of manual checks proves very little. You need a dataset, scorers and traces to make claims about quality.",
    },
  },
  {
    id: "d1-m1",
    day: 1,
    start: "0:15",
    minutes: 35,
    title: "Reverse-engineer the agent: LangGraph anatomy",
    emoji: "🧬",
    color: "from-sky-500 to-indigo-500",
    kind: "module",
    hook: "We watched it work. Now: what is it actually made of?",
    doFirst: [
      { step: "Run “💸 Eligible refund”. Watch the graph light up node by node. Write down the path.", link: { href: "/lab", label: "Agent Lab" } },
      { step: "Run “Hello there!” (type it). Compare the path. Why is it so much shorter?" },
      { step: "Run “🧨 Injection”. Which node stopped it? Did any LLM get called?" },
      { step: "Open src/lib/agent/graph.ts and find the 4 numbered sections: State, Nodes, Edges, Run." },
    ],
    breakDown: [
      { term: "State", body: "One typed object (Annotation.Root) flowing through the graph: message, intent, order, policy, refund, response… Every node reads state and returns a partial update." },
      { term: "Nodes", body: "Plain async functions. Some call an LLM (classify_intent, respond), some are deterministic code (input_guardrail, check_policy), some call tools (lookup_order, issue_refund)." },
      { term: "Edges & conditional edges", body: "addEdge = always go next. addConditionalEdges = a routing function picks the next node from state. Routing is where most agent bugs live." },
      { term: "Reducers", body: "The `path` channel uses a reducer that appends. That gives us the trajectory for free, and the trajectory is the backbone of agent evals." },
      { term: "Design principle: policy in code, language in the model", body: "The refund rules (30 days, $500, final sale) live in check_policy as code, not in a prompt. LLMs classify and write; code decides money." },
      { term: "Dependency injection via configurable", body: "Tracer, mode and version are passed through LangGraph’s `configurable`. The same compiled graph serves every version, which keeps comparisons fair." },
    ],
    codeRefs: [
      { file: "src/lib/agent/graph.ts", why: "The whole agent: state → nodes → edges → runAgent()" },
      { file: "src/lib/agent/data.ts", why: "ShopSmart’s orders DB and knowledge base (the “real world”)" },
    ],
    discuss: ["Which nodes MUST be deterministic code in your own domain?", "What would happen if the refund decision were made by the LLM?"],
    quiz: {
      q: "In LangGraph, what decides which node runs after classify_intent?",
      options: ["The LLM automatically", "A conditional edge’s routing function reading state.intent", "The order nodes were added", "LangSmith"],
      answer: 1,
      why: "routeByIntent() inspects state and returns the next node name. It’s just code, so you can test it.",
    },
    resources: [
      { title: "LangGraph.js documentation", url: "https://langchain-ai.github.io/langgraphjs/" },
      { title: "Anthropic: Building effective agents", url: "https://www.anthropic.com/research/building-effective-agents" },
    ],
  },
  {
    id: "d1-m2",
    day: 1,
    start: "0:50",
    minutes: 35,
    title: "Observability: traces, spans & the agent’s black box",
    emoji: "🔭",
    color: "from-amber-400 to-orange-500",
    kind: "module",
    hook: "The graph tells you WHERE it went. The trace tells you WHAT happened at every step, how long it took and what it cost.",
    doFirst: [
      { step: "Run “💸 Eligible refund” and scroll to the Trace Waterfall. Click every span.", link: { href: "/lab", label: "Agent Lab" } },
      { step: "Find: ① the slowest span 🐢 ② the exact prompt sent to the model ③ input/output tokens ④ cost of the run." },
      { step: "Team race: which scenario is the most expensive? Which is the slowest? Why?" },
      { step: "Open src/lib/agent/tracer.ts. It’s only ~90 lines. Find how a child span knows its parent." },
    ],
    breakDown: [
      { term: "Trace", body: "The full record of one request: a tree of spans with a shared trace id. One customer message = one trace." },
      { term: "Span", body: "One unit of work with start/end time, status, inputs, outputs and attributes. Our kinds: agent, node, llm, tool, retriever, guardrail." },
      { term: "Attributes & OTel GenAI conventions", body: "Standard keys like gen_ai.request.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens let any backend (LangSmith, Langfuse, Phoenix, Datadog) understand your spans." },
      { term: "The 5 signals for agents", body: "Latency (p50/p95), Cost (tokens × price), Quality (eval scores), Errors (exceptions, refusals), Safety (guardrail hits, PII). Classic APM covers 2 of these 5." },
      { term: "What to log & what NOT to", body: "Log prompts, tool args, outputs and model versions so you can debug. Redact PII before it reaches logs and models. Note how input_guardrail replaces card numbers with [REDACTED_CARD]." },
      { term: "Build vs buy", body: "Our tracer is hand-rolled so you can see inside. In production use LangSmith (set LANGSMITH_TRACING=true: zero code changes for LangGraph), Langfuse, Arize Phoenix or OpenTelemetry exporters." },
    ],
    codeRefs: [
      { file: "src/lib/agent/tracer.ts", why: "Span/Trace model and the parent-stack trick" },
      { file: "src/lib/agent/llm.ts", why: "Where LLM spans get model, tokens and cost attributes" },
    ],
    discuss: ["Which of the 5 signals does your current stack capture today?", "Who should be allowed to read raw prompts in production logs?"],
    quiz: {
      q: "A refund request took 4.2s. The trace shows llm.generate_response = 3.6s. What’s your first optimisation lever?",
      options: ["Add more servers", "Look at that span’s prompt/token counts and model choice", "Remove the policy check", "Disable tracing"],
      answer: 1,
      why: "Traces localise the problem. Long output, oversized context or a heavyweight model on a simple step are the usual suspects. (Removing the policy check is exactly the v2 mistake!)",
    },
    resources: [
      { title: "OpenTelemetry: GenAI semantic conventions", url: "https://opentelemetry.io/docs/specs/semconv/gen-ai/" },
      { title: "LangSmith observability docs", url: "https://docs.smith.langchain.com/observability" },
      { title: "Langfuse docs (open source)", url: "https://langfuse.com/docs" },
      { title: "Arize Phoenix (open source)", url: "https://docs.arize.com/phoenix" },
    ],
  },
  { id: "d1-break", day: 1, start: "1:25", minutes: 10, title: "Break ☕", emoji: "☕", color: "from-slate-500 to-slate-600", kind: "break" },
  {
    id: "d1-m3",
    day: 1,
    start: "1:35",
    minutes: 40,
    title: "Incident drill: debugging v2 “Speed Patch” by trace",
    emoji: "🚨",
    color: "from-rose-500 to-pink-500",
    kind: "module",
    hook: "A teammate shipped v2: “faster and friendlier!” Customer complaints are rolling in. You have only the traces. Find the root causes.",
    doFirst: [
      { step: "In the Lab, switch to v2 · Speed Patch. Run “⏰ Late refund”, “👻 Unknown order” and “🕵️ Prompt leak”.", link: { href: "/lab", label: "Agent Lab" } },
      { step: "Run the SAME three messages on v1. Compare paths and responses side-by-side using Run history." },
      { step: "In pairs, write an incident report: symptom → evidence in trace (which span?) → root cause → fix." },
      { step: "Bonus: open src/lib/agent/versions.ts and check if you found all 3 changes." },
    ],
    breakDown: [
      { term: "Agent failure taxonomy", body: "Wrong route (bad intent) · Skipped step (missing check_policy) · Tool misuse (wrong args) · Ungrounded answer / hallucination · Guardrail bypass · Infinite loops / runaway cost." },
      { term: "Trajectory vs final answer", body: "v2’s refund reply sounds perfect. Only the trajectory shows check_policy never ran. Always evaluate HOW the agent got there, not just WHAT it said." },
      { term: "Prompt changes are code changes", body: "“Never tell the customer you don’t know” looks harmless, yet it caused hallucinated order statuses. Prompts need review, versioning and tests like any code." },
      { term: "Root-cause workflow", body: "Symptom (complaint) → find the trace → locate the first wrong span → diff prompt/code/config against the last good version → write a test that reproduces it (tomorrow!)." },
    ],
    codeRefs: [
      { file: "src/lib/agent/versions.ts", why: "The three “harmless” changes in v2" },
      { file: "src/lib/agent/graph.ts", why: "routeAfterLookup() and responderPrompt(): where the flags bite" },
    ],
    discuss: ["Would your current monitoring have caught v2 before customers did?", "Latency improved slightly. Was it worth it?"],
    quiz: {
      q: "v2 approved a refund for a 45-day-old order and the reply looked perfect. What exposed the bug?",
      options: ["The response text", "The trajectory: check_policy is missing from the path", "User satisfaction score", "Token count"],
      answer: 1,
      why: "The final answer was fluent and confident. The path showed the policy step was skipped.",
    },
  },
  {
    id: "d1-m4",
    day: 1,
    start: "2:15",
    minutes: 15,
    title: "Day 1 recap & homework",
    emoji: "🧠",
    color: "from-violet-500 to-fuchsia-500",
    kind: "module",
    doFirst: [
      { step: "Everyone: in one sentence, what’s the difference between a trace and a log?" },
      { step: "Homework: write 5 customer messages you believe would break v1. (We’ll turn them into tests tomorrow.)" },
    ],
    breakDown: [
      { term: "Day 1 in one line", body: "You can’t improve what you can’t see. Traces turn a black-box agent into a debuggable system." },
      { term: "Cliffhanger", body: "We FOUND v2’s bugs by hand. Tomorrow we make a machine find them automatically, before deploy." },
    ],
  },

  // ───────────────────────────────── DAY 2 ─────────────────────────────────
  {
    id: "d2-m5",
    day: 2,
    start: "0:00",
    minutes: 15,
    title: "Hook: “Ship v2? It feels faster.”",
    emoji: "🎯",
    color: "from-amber-400 to-orange-500",
    kind: "module",
    hook: "Your PM wants v2 live today. Yesterday we needed 40 minutes to find its bugs by hand. Watch this take 5 seconds.",
    doFirst: [
      { step: "Run in a terminal: npm run eval -- v1 --mock, then npm run eval -- v2 --mock. Watch the quality gate." },
      { step: "Open the Evals page and click “Run all versions”.", link: { href: "/evals", label: "Eval Runner" } },
    ],
    breakDown: [
      { term: "An eval = dataset + task + scorer(s)", body: "Dataset: inputs with expectations. Task: run the agent. Scorers: functions that turn a run into pass/fail or a score." },
      { term: "Offline vs online evaluation", body: "Offline: curated dataset, before deploy, has ground truth. Online: real traffic, after deploy, usually no ground truth. You need both." },
    ],
    quiz: {
      q: "What does the eval give you that yesterday’s manual debugging didn’t?",
      options: ["Prettier charts", "Repeatable, automatic, comparable measurement on every change", "Lower latency", "A better model"],
      answer: 1,
      why: "The same suite runs on every PR/model change, producing comparable numbers.",
    },
  },
  {
    id: "d2-m6",
    day: 2,
    start: "0:15",
    minutes: 40,
    title: "Golden datasets & code-based evaluators",
    emoji: "🧪",
    color: "from-emerald-400 to-teal-500",
    kind: "module",
    hook: "We just saw scores. Now open the box: what is a test case for an agent, and how does a function grade it?",
    doFirst: [
      { step: "On the Evals page, run v1. Click the failing case es-01 and read every evaluator verdict.", link: { href: "/evals", label: "Eval Runner" } },
      { step: "Click “Open this case in the Lab” to see its trace. Connect the failed evaluator to the wrong span." },
      { step: "Open src/lib/evals/dataset.ts. Read 3 cases. Then open evaluators.ts and match each evaluator to a failure type from Day 1." },
    ],
    breakDown: [
      { term: "Anatomy of a golden case", body: "input + reference (ground-truth notes) + expectations: intent, path (ordered subsequence), notPath (forbidden), outcome (refund/blocked), contains / containsAny / notContains." },
      { term: "Five kinds of code-based graders", body: "Exact match (intent) · Trajectory (subsequence + forbidden steps) · State/outcome check (refund status) · String/regex grounding · Universal safety (no PII, no prompt leak). Cheap, fast, deterministic: use them first." },
      { term: "Trajectory evaluation", body: "Don’t require the exact path, which is brittle. Require the essential steps in order and forbid dangerous ones (decide_refund must never run on an injection)." },
      { term: "Where cases come from", body: "① Happy paths ② Policy edge cases (day 30 vs 31, $500) ③ Adversarial (injection, PII) ④ Production failures (yesterday’s homework!) ⑤ Every bug you fix becomes a test." },
      { term: "Start small", body: "20–50 sharp cases beat 5,000 vague ones. Each case should exist for a reason you can explain." },
      { term: "Non-determinism", body: "In live mode the same input can produce different outputs. Run important cases several times (pass@k / pass^k) and track the variance, not just the mean." },
    ],
    codeRefs: [
      { file: "src/lib/evals/dataset.ts", why: "17 golden cases across 6 categories" },
      { file: "src/lib/evals/evaluators.ts", why: "5 code evaluators + LLM judge" },
      { file: "src/lib/evals/runner.ts", why: "Runs cases concurrently and aggregates scores" },
    ],
    discuss: ["Which evaluator would have caught your most painful real production bug?", "What’s a policy edge case in YOUR domain?"],
    quiz: {
      q: "Which grader catches “v2 skipped check_policy but still wrote a perfect reply”?",
      options: ["grounding", "trajectory", "llm_judge", "latency"],
      answer: 1,
      why: "Only trajectory evaluation inspects the steps taken. The reply text alone looks correct.",
    },
    resources: [
      { title: "Anthropic: Define success criteria & build evaluations", url: "https://docs.claude.com/en/docs/test-and-evaluate/develop-tests" },
      { title: "Hamel Husain: Your AI product needs evals", url: "https://hamel.dev/blog/posts/evals/" },
      { title: "LangSmith evaluation concepts", url: "https://docs.smith.langchain.com/evaluation" },
    ],
  },
  {
    id: "d2-m7",
    day: 2,
    start: "0:55",
    minutes: 35,
    title: "LLM-as-a-judge: grading what code can’t",
    emoji: "⚖️",
    color: "from-violet-500 to-indigo-500",
    kind: "module",
    hook: "“Was the reply helpful, polite and faithful?” A regex can’t answer that. Another model can, if you hold it accountable.",
    doFirst: [
      { step: "Run evals with “LLM-as-judge” ON. Expand failing rows and read the judge’s reasoning.", link: { href: "/evals", label: "Eval Runner" } },
      { step: "Find a case where code evaluators pass but the judge fails (or vice versa). Who is right?" },
      { step: "With a live key: run the same version twice. Did any judge scores change? Discuss why." },
      { step: "Read JUDGE_RUBRIC in evaluators.ts. Improve one line of it as a team." },
    ],
    breakDown: [
      { term: "Rubric-based, reference-guided judging", body: "Give the judge a clear scale (1–5 with definitions), the ground truth and the reply. Ask for reasoning first, then the score. Use structured output so the verdict always parses." },
      { term: "Binary beats Likert (often)", body: "Pass/fail per criterion is easier to calibrate than a 1–10 score. We use 1–5 but threshold at ≥4 = pass." },
      { term: "Known judge biases", body: "Position bias, verbosity bias (longer = better), self-preference (likes its own model family), leniency. Mitigate with rubrics, references, and a different/cheaper model for judging." },
      { term: "Calibrate against humans", body: "Label 30–50 cases by hand, then measure judge-human agreement. Don’t trust a judge you haven’t measured." },
      { term: "Cost & model choice", body: "Our agent uses Claude Opus 5.5; the judge uses Claude Haiku 5.5. Judges run on every case of every run, so cheap matters. Watch the “Judge cost” tile." },
      { term: "Code first, judge second", body: "Use deterministic graders wherever possible. Reserve the judge for tone, helpfulness and faithfulness." },
    ],
    codeRefs: [{ file: "src/lib/evals/evaluators.ts", why: "llmJudge(), JUDGE_RUBRIC and the structured-output schema" }],
    quiz: {
      q: "Your judge gives 5/5 to long answers and 3/5 to short correct ones. What’s happening?",
      options: ["The short answers are wrong", "Verbosity bias: fix the rubric and calibrate against human labels", "The judge model is broken", "Increase temperature"],
      answer: 1,
      why: "Verbosity bias is one of the most common judge failures. Penalise unnecessary length explicitly and validate with human labels.",
    },
    resources: [
      { title: "Zheng et al.: Judging LLM-as-a-Judge (MT-Bench)", url: "https://arxiv.org/abs/2306.05685" },
      { title: "Hamel Husain: Creating an LLM-as-a-judge that drives results", url: "https://hamel.dev/blog/posts/llm-judge/" },
      { title: "Eugene Yan: Evaluating the effectiveness of LLM-evaluators", url: "https://eugeneyan.com/writing/llm-evaluators/" },
    ],
  },
  { id: "d2-break", day: 2, start: "1:30", minutes: 10, title: "Break ☕", emoji: "☕", color: "from-slate-500 to-slate-600", kind: "break" },
  {
    id: "d2-m8",
    day: 2,
    start: "1:40",
    minutes: 30,
    title: "Regression gates & production monitoring",
    emoji: "📡",
    color: "from-sky-500 to-cyan-500",
    kind: "module",
    hook: "Evals before deploy, detectors after deploy, and a loop that connects them.",
    doFirst: [
      { step: "Run v1 then v2 on the Evals page. Use “Regression diff” to compare. Count regressions.", link: { href: "/evals", label: "Eval Runner" } },
      { step: "Open the Monitor. Simulate 20 requests on v1, then 20 on v2 (“deploy”). Watch alerts appear.", link: { href: "/monitor", label: "Ops Dashboard" } },
      { step: "Read scripts/eval.ts: notice process.exit(1) when below threshold. That one line blocks a bad deploy in CI." },
    ],
    breakDown: [
      { term: "Regression diff", body: "Aggregate scores hide trade-offs. Compare per case: which passed before and fail now? One new safety regression can outweigh +5% elsewhere." },
      { term: "Quality gates in CI", body: "Run the suite on every PR and on every model/prompt change. Fail the build below a threshold, and require zero regressions on critical categories (safety, refunds)." },
      { term: "Online detectors (no ground truth)", body: "Heuristics on live traces: refund without policy check, ‘not found’ but no apology (hallucination risk), injection reached the LLM, PII in output. Cheap and always on." },
      { term: "Operational metrics", body: "p50/p95 latency, cost per request, block rate, escalation rate, intent mix. Sudden shifts = drift or a bad deploy." },
      { term: "The Eval Flywheel", body: "Production trace → alert → human review → new golden case → fix → eval gate passes → deploy → monitor. Your dataset grows from reality." },
    ],
    codeRefs: [
      { file: "scripts/eval.ts", why: "CLI + CI quality gate (exit code)" },
      { file: "src/app/monitor/page.tsx", why: "DETECTORS: online evaluators as plain functions" },
    ],
    quiz: {
      q: "v2’s overall pass rate dropped 47 points and p50 latency barely moved. What do you do?",
      options: ["Ship it, latency is fine", "Block the deploy, the gate failed and safety regressed", "Ship to 50% of users", "Retrain the model"],
      answer: 1,
      why: "Quality and safety regressions trump small speed gains. That’s what the gate is for.",
    },
    resources: [
      { title: "τ-bench: tool-agent-user benchmark (paper)", url: "https://arxiv.org/abs/2406.12045" },
      { title: "promptfoo: evals in CI", url: "https://www.promptfoo.dev/docs/intro/" },
      { title: "OWASP Top 10 for LLM applications", url: "https://genai.owasp.org/llm-top-10/" },
    ],
  },
  {
    id: "d2-m9",
    day: 2,
    start: "2:10",
    minutes: 20,
    title: "Capstone: close the loop yourself",
    emoji: "🏆",
    color: "from-fuchsia-500 via-amber-400 to-emerald-400",
    kind: "module",
    hook: "Teams of 2–3. You own ShopSmart’s agent quality now.",
    doFirst: [
      { step: "① Add 2 cases to dataset.ts from yesterday’s homework (or from the Monitor alert feed)." },
      { step: "② Add a new evaluator to evaluators.ts. Ideas: “reply ≤ 80 words”, “mentions ticket id when escalated”, “no markdown”." },
      { step: "③ Run npm run eval -- v3. Does v3 still pass the gate? If not, fix the agent (graph.ts / versions.ts) or argue your test is wrong." },
      { step: "④ 2-minute demo per team: what you added, what it caught, what you’d monitor in production." },
    ],
    breakDown: [
      { term: "Production-readiness checklist", body: "✅ Traced end-to-end ✅ Golden dataset with adversarial cases ✅ Code graders + calibrated judge ✅ CI quality gate ✅ Online detectors & alerts ✅ Flywheel from prod failures to tests ✅ Cost & latency budgets." },
      { term: "The answer to the workshop question", body: "You know your agent is actually good when you can show the trace, show the score, show it didn’t regress, and show you’d know within minutes if it did." },
    ],
  },
];
