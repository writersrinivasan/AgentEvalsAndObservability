import { runAgent, type AgentRun } from "../agent/graph";
import { resolveMode, type Mode } from "../agent/llm";
import { Tracer } from "../agent/tracer";
import type { VersionId } from "../agent/versions";
import { DATASET, type EvalCase } from "./dataset";
import { CODE_EVALUATORS, llmJudge, type EvalResult } from "./evaluators";

export interface CaseResult {
  case: EvalCase;
  run: AgentRun;
  results: EvalResult[];
  pass: boolean;
}

export interface EvalReport {
  id: string;
  version: VersionId;
  mode: Mode;
  judge: boolean;
  createdAt: string;
  cases: CaseResult[];
  summary: {
    passRate: number;
    passed: number;
    total: number;
    byEvaluator: Record<string, { passRate: number; n: number }>;
    byCategory: Record<string, { passRate: number; n: number }>;
    p50Ms: number;
    p95Ms: number;
    agentCostUsd: number;
    judgeCostUsd: number;
    avgTokens: number;
  };
}

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

/** Run items with bounded concurrency (be kind to rate limits). */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function runEvalSuite(opts: {
  version: VersionId;
  mode?: string;
  judge?: boolean;
  caseIds?: string[];
}): Promise<EvalReport> {
  const mode = resolveMode(opts.mode);
  const judge = opts.judge ?? true;
  const cases = opts.caseIds?.length ? DATASET.filter((c) => opts.caseIds!.includes(c.id)) : DATASET;
  const judgeTracer = new Tracer();

  const caseResults = await pool(cases, mode === "live" ? 4 : 8, async (c): Promise<CaseResult> => {
    const run = await runAgent(c.input, { version: opts.version, mode });
    const results = CODE_EVALUATORS.map((e) => e(c, run));
    if (judge) results.push(await llmJudge(c, run, mode, judgeTracer));
    return { case: c, run, results, pass: results.every((r) => r.pass) };
  });

  const byEvaluator: EvalReport["summary"]["byEvaluator"] = {};
  const byCategory: EvalReport["summary"]["byCategory"] = {};
  for (const cr of caseResults) {
    for (const r of cr.results) {
      if (r.skipped) continue;
      const b = (byEvaluator[r.evaluator] ??= { passRate: 0, n: 0 });
      b.passRate += +r.pass;
      b.n++;
    }
    const c = (byCategory[cr.case.category] ??= { passRate: 0, n: 0 });
    c.passRate += +cr.pass;
    c.n++;
  }
  for (const b of [...Object.values(byEvaluator), ...Object.values(byCategory)]) b.passRate = b.n ? b.passRate / b.n : 0;

  const latencies = caseResults.map((c) => c.run.trace.totalMs);
  const passed = caseResults.filter((c) => c.pass).length;
  return {
    id: `eval_${Date.now().toString(36)}`,
    version: opts.version,
    mode,
    judge,
    createdAt: new Date().toISOString(),
    cases: caseResults,
    summary: {
      passRate: caseResults.length ? passed / caseResults.length : 0,
      passed,
      total: caseResults.length,
      byEvaluator,
      byCategory,
      p50Ms: percentile(latencies, 50),
      p95Ms: percentile(latencies, 95),
      agentCostUsd: +caseResults.reduce((a, c) => a + c.run.trace.costUsd, 0).toFixed(5),
      judgeCostUsd: judgeTracer.finish().costUsd,
      avgTokens: Math.round(
        caseResults.reduce((a, c) => a + c.run.trace.inputTokens + c.run.trace.outputTokens, 0) / (caseResults.length || 1),
      ),
    },
  };
}
