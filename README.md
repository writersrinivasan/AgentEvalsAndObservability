# EvalOps Lab: Agent Evals & Observability

> **How do you know your agent is actually good?**
> A hands-on, build-first workshop app (5 hours · 2 days × 2.5h) built with **Next.js + LangGraph.js + Claude**.

Participants run a real, industrial-style agent first, watch it work, break it, catch it with evals, fix it, and **only then** name the concepts.

## The project: ShopSmart Customer Support Agent

A LangGraph `StateGraph` that:

- 🛡 blocks prompt injection and redacts card numbers (`input_guardrail`)
- 🧭 classifies intent with Claude using structured outputs (`classify_intent`)
- 📦 looks up orders (`lookup_order` tool)
- 📜 checks refund policy in **code**: 30-day window, $500 review, final sale (`check_policy`)
- 💸 issues refunds or escalates (`decide_refund`, `escalate_to_human`)
- 📚 answers product questions from a knowledge base (`search_kb`)
- ✍️ writes a grounded reply (`respond`) and redacts PII on the way out (`output_guardrail`)

Three releases tell the story:

| Version | Story | Offline eval |
|---|---|---|
| v1 · Baseline | Ships, has 2 blind spots | 88% ✅ |
| v2 · Speed Patch | "Harmless" PR: skips policy, hallucinates, no guardrail | 41% ⛔ |
| v3 · Hardened | Fixed with evidence from traces + evals | 100% ✅ |

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

- **No API key?** Everything works with the deterministic **offline simulator** (the badge in the nav shows `MOCK`).
- **Live Claude:** `cp .env.example .env.local` and set `ANTHROPIC_API_KEY`. The agent uses `claude-opus-5-5`; the judge uses `claude-haiku-5-5`.
- **LangSmith (optional):** set `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` to mirror every run.

### Evals from the terminal / CI

```bash
npm run eval -- v1 --mock
npm run eval -- v2 --mock                 # exits 1: quality gate fails
npm run eval -- v3 --threshold 0.9 --no-judge
```

## App map

| Page | Purpose |
|---|---|
| `/` | Workshop overview and method |
| `/curriculum` | 5-hour plan: every module is ▶ Do first → 🔍 Break it down, with quizzes and progress |
| `/lab` | Chat with the agent, animated graph trajectory, trace waterfall and span inspector |
| `/evals` | Golden dataset × 6 evaluators, scorecards, leaderboard, regression diff, per-case drill-down |
| `/monitor` | Simulated production traffic, latency/cost/intent dashboards, online detectors and alert feed |
| `/resources` | Setup, project map, glossary, curated reading |

## Code map

```
src/lib/agent/graph.ts      LangGraph agent (state → nodes → edges → runAgent)
src/lib/agent/tracer.ts     Minimal OpenTelemetry-style tracer
src/lib/agent/llm.ts        Claude (live) / simulator (mock), tokens & cost
src/lib/agent/versions.ts   v1 / v2 / v3 flags
src/lib/evals/dataset.ts    Golden dataset (participants extend this)
src/lib/evals/evaluators.ts Code graders + LLM-as-judge
src/lib/evals/runner.ts     Suite runner & aggregation
scripts/eval.ts             CLI + CI quality gate
src/content/curriculum.ts   Curriculum content (edit to tailor the session)
```
