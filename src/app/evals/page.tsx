"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { Bar, ModeToggle, Ring, SectionTitle, Stat, VersionPicker, scoreColor } from "@/components/ui";
import { VERSIONS, type VersionId } from "@/lib/agent/versions";
import { fmtMs, fmtUsd, pct, postJSON, usePersistentState, type EvalReport } from "@/lib/client";

const GATE = 0.85;

const EVALUATOR_INFO: Record<string, { kind: "code" | "model"; q: string }> = {
  intent_accuracy: { kind: "code", q: "Did the router pick the right intent?" },
  trajectory: { kind: "code", q: "Did the agent take the right steps, in order, and skip forbidden ones?" },
  outcome: { kind: "code", q: "Was the business decision (refund / block) policy-correct?" },
  grounding: { kind: "code", q: "Does the reply contain required facts and avoid forbidden claims?" },
  safety: { kind: "code", q: "No leaked card numbers, no leaked system prompt, no crashes." },
  llm_judge: { kind: "model", q: "A second model grades the reply 1–5 against a rubric + ground truth." },
};

/** Keep stored history small: drop span payloads, keep the numbers. */
function slim(r: EvalReport): EvalReport {
  return {
    ...r,
    cases: r.cases.map((c) => ({ ...c, run: { ...c.run, trace: { ...c.run.trace, spans: [] } } })),
  };
}

export default function EvalsPage() {
  const [version, setVersion] = usePersistentState<VersionId>("evals.version", "v1");
  const [mode, setMode] = usePersistentState<"auto" | "mock">("mode", "auto");
  const [judge, setJudge] = usePersistentState("evals.judge", true);
  const [history, setHistory] = usePersistentState<EvalReport[]>("evals.history", []);
  const [current, setCurrent] = useState<EvalReport | null>(null);
  const [baselineId, setBaselineId] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const report = current ?? history[0] ?? null;

  async function run(versions: VersionId[]) {
    setError(null);
    try {
      for (const v of versions) {
        setLoading(`Running ${VERSIONS[v].name} on the golden dataset…`);
        const r = await postJSON<EvalReport>("/api/evals", { version: v, mode, judge });
        setCurrent(r);
        setHistory((h) => [slim(r), ...h].slice(0, 10));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  const baseline = history.find((h) => h.id === baselineId && h.id !== report?.id) ?? null;
  const diff = useMemo(() => {
    if (!report || !baseline) return null;
    const prev = new Map(baseline.cases.map((c) => [c.case.id, c.pass]));
    return report.cases
      .filter((c) => prev.has(c.case.id) && prev.get(c.case.id) !== c.pass)
      .map((c) => ({ id: c.case.id, input: c.case.input, regression: !c.pass }));
  }, [report, baseline]);

  const leaderboard = useMemo(() => {
    const latest = new Map<VersionId, EvalReport>();
    for (const h of history) if (!latest.has(h.version)) latest.set(h.version, h);
    return [...latest.values()].sort((a, b) => a.version.localeCompare(b.version));
  }, [history]);

  return (
    <div>
      <SectionTitle eyebrow="Measure it · prove it" title={<>Eval <span className="gradient-text">Runner</span></>}>
        A golden dataset of 17 real-world support conversations, scored by 5 code-based evaluators and 1 LLM-as-a-judge. Run each agent
        version and let the numbers, not vibes, decide what ships.
      </SectionTitle>

      <div className="card mb-6 space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">Version under test</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} className="accent-fuchsia-500" />
              LLM-as-judge
            </label>
            <ModeToggle value={mode} onChange={setMode} />
          </div>
        </div>
        <VersionPicker value={version} onChange={setVersion} />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={!!loading} onClick={() => run([version])}>
            ▶ Run eval suite
          </button>
          <button className="btn-ghost" disabled={!!loading} onClick={() => run(["v1", "v2", "v3"])}>
            Run all versions
          </button>
          {history.length > 0 && (
            <button className="btn-ghost text-xs" disabled={!!loading} onClick={() => (setHistory([]), setCurrent(null))}>
              Clear history
            </button>
          )}
          {loading && <span className="animate-pulse text-sm text-amber-300">{loading}</span>}
          {error && <span className="text-sm text-rose-300">{error}</span>}
        </div>
      </div>

      {!report && (
        <div className="card p-8 text-center text-muted">
          <div className="mb-2 text-4xl">🧪</div>
          No eval runs yet. Run <b className="text-ink">v1 · Baseline</b> first. Then try v2 and ask: <i>would you ship it?</i>
        </div>
      )}

      {report && (
        <>
          {/* Scorecard */}
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <div className="card flex flex-col items-center justify-center gap-2 p-5">
              <Ring value={report.summary.passRate} />
              <div className="text-sm font-semibold">{VERSIONS[report.version].name}</div>
              <div
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  report.summary.passRate >= GATE ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {report.summary.passRate >= GATE ? "✅ Quality gate passed" : "⛔ Quality gate failed"} ({pct(GATE)})
              </div>
              <div className="text-[11px] text-muted">
                {report.mode} mode · {new Date(report.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Cases passed" value={`${report.summary.passed}/${report.summary.total}`} sub="a case passes only if every evaluator passes" />
              <Stat label="p50 latency" value={fmtMs(report.summary.p50Ms)} tone="from-sky-500/25 to-indigo-500/10" />
              <Stat label="p95 latency" value={fmtMs(report.summary.p95Ms)} tone="from-indigo-500/25 to-violet-500/10" />
              <Stat label="Agent cost" value={fmtUsd(report.summary.agentCostUsd)} sub={`${report.summary.total} runs`} tone="from-emerald-500/25 to-teal-500/10" />
              <Stat label="Judge cost" value={fmtUsd(report.summary.judgeCostUsd)} sub="evals cost money too" tone="from-amber-500/25 to-orange-500/10" />
              <Stat label="Avg tokens / run" value={report.summary.avgTokens} tone="from-pink-500/25 to-rose-500/10" />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <div className="label mb-3">By evaluator: what kind of failure?</div>
              <div className="space-y-3">
                {Object.entries(report.summary.byEvaluator).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{k}</span>
                        <span className={`rounded px-1.5 text-[10px] ${EVALUATOR_INFO[k]?.kind === "model" ? "bg-amber-500/20 text-amber-300" : "bg-sky-500/20 text-sky-300"}`}>
                          {EVALUATOR_INFO[k]?.kind ?? "code"}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {pct(v.passRate)} <span className="text-muted">· {v.n}</span>
                      </span>
                    </div>
                    <Bar value={v.passRate} color={scoreColor(v.passRate)} />
                    <div className="mt-0.5 text-[11px] text-muted">{EVALUATOR_INFO[k]?.q}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-4">
                <div className="label mb-3">By scenario category</div>
                <div className="space-y-2.5">
                  {Object.entries(report.summary.byCategory).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_1fr_48px] items-center gap-2 text-xs">
                      <span className="font-mono">{k}</span>
                      <Bar value={v.passRate} color={scoreColor(v.passRate)} />
                      <span className="text-right tabular-nums">{pct(v.passRate)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {leaderboard.length > 1 && (
                <div className="card p-4">
                  <div className="label mb-3">Version leaderboard (latest run each)</div>
                  <div className="flex h-36 items-end gap-4">
                    {leaderboard.map((r) => (
                      <div key={r.id} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-sm font-bold tabular-nums">{pct(r.summary.passRate)}</span>
                        <div className={`w-full rounded-t-lg bg-gradient-to-t ${VERSIONS[r.version].color}`} style={{ height: `${Math.max(r.summary.passRate * 100, 4)}px` }} />
                        <span className="text-xs text-muted">{r.version}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Regression compare */}
          <div className="card mt-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="label">Regression diff · compare against</span>
              <select
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="rounded-lg border border-line bg-black/40 px-2 py-1 text-xs"
              >
                <option value="">choose a baseline run…</option>
                {history
                  .filter((h) => h.id !== report.id)
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.version} · {pct(h.summary.passRate)} · {h.mode} · {new Date(h.createdAt).toLocaleTimeString()}
                    </option>
                  ))}
              </select>
            </div>
            {diff && (
              <div className="mt-3">
                <div className="mb-2 text-sm">
                  <b>{baseline!.version}</b> {pct(baseline!.summary.passRate)} → <b>{report.version}</b> {pct(report.summary.passRate)}{" "}
                  <span className={report.summary.passRate >= baseline!.summary.passRate ? "text-emerald-300" : "text-rose-300"}>
                    ({report.summary.passRate >= baseline!.summary.passRate ? "+" : ""}
                    {Math.round((report.summary.passRate - baseline!.summary.passRate) * 100)} pts)
                  </span>
                </div>
                {diff.length === 0 && <div className="text-sm text-muted">No case changed outcome.</div>}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {diff.map((d) => (
                    <div key={d.id} className={`rounded-lg px-3 py-2 text-xs ${d.regression ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"}`}>
                      <b>{d.regression ? "▼ REGRESSION" : "▲ FIXED"}</b> <span className="font-mono">{d.id}</span> · {d.input}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Case table */}
          <div className="card mt-4 overflow-hidden">
            <div className="border-b border-line px-4 py-3 label">Per-case results · click a row to drill down</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Customer message</th>
                    {Object.keys(EVALUATOR_INFO).map((k) => (
                      <th key={k} className="px-1 py-2 text-center font-mono text-[10px]" title={EVALUATOR_INFO[k].q}>
                        {k.replace("_accuracy", "").replace("llm_", "")}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cases.map((c) => {
                    const isOpen = open === c.case.id;
                    return (
                      <Fragment key={c.case.id}>
                        <tr onClick={() => setOpen(isOpen ? null : c.case.id)} className={`cursor-pointer border-b border-white/5 hover:bg-panel-strong ${c.pass ? "" : "bg-rose-500/[0.06]"}`}>
                          <td className="px-3 py-2 font-mono">
                            {c.pass ? "✅" : "❌"} {c.case.id}
                          </td>
                          <td className="max-w-[360px] truncate px-3 py-2">{c.case.input}</td>
                          {Object.keys(EVALUATOR_INFO).map((k) => {
                            const r = c.results.find((x) => x.evaluator === k);
                            return (
                              <td key={k} className="px-1 py-2 text-center">
                                {!r || r.skipped ? (
                                  <span className="text-white/20">·</span>
                                ) : (
                                  <span className={`inline-block h-3 w-3 rounded-full ${r.pass ? "bg-emerald-400" : "bg-rose-500"}`} title={r.detail} />
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-mono text-muted">{fmtMs(c.run.trace.totalMs)}</td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-line bg-black/20">
                            <td colSpan={9} className="space-y-3 px-4 py-4">
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div className="space-y-2">
                                  <div className="label">Agent reply</div>
                                  <div className="rounded-lg border border-line bg-panel-strong p-3 text-sm">{c.run.response || <i>(empty)</i>}</div>
                                  <div className="label">Ground truth</div>
                                  <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-100">{c.case.reference}</div>
                                  <div className="font-mono text-[11px] text-amber-200">path: {c.run.path.join(" → ")}</div>
                                </div>
                                <div>
                                  <div className="label mb-1">Evaluator verdicts</div>
                                  <div className="space-y-1">
                                    {c.results.map((r) => (
                                      <div key={r.evaluator} className="flex gap-2 rounded-md bg-white/[0.03] px-2 py-1.5">
                                        <span>{r.skipped ? "⚪" : r.pass ? "🟢" : "🔴"}</span>
                                        <span className="w-28 shrink-0 font-mono">{r.evaluator}</span>
                                        <span className="text-muted">{r.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <Link
                                    href={`/lab#q=${encodeURIComponent(c.case.input)}&v=${report.version}`}
                                    className="btn-ghost mt-3 text-xs"
                                  >
                                    🔬 Open this case in the Lab to see its trace
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
