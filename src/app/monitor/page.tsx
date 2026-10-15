"use client";

import { useMemo, useState } from "react";
import { Bar, ModeToggle, SectionTitle, Stat, VersionPicker } from "@/components/ui";
import { VERSIONS, type VersionId } from "@/lib/agent/versions";
import { fmtMs, fmtUsd, pct, postJSON, usePersistentState, type AgentRun } from "@/lib/client";

// ── Online detectors: no ground truth needed — they run on every production trace.
const DETECTORS: { id: string; label: string; desc: string; test: (r: AgentRun) => boolean }[] = [
  {
    id: "policy_bypass",
    label: "Refund without policy check",
    desc: "decide_refund ran but check_policy never did",
    test: (r) => r.path.includes("decide_refund") && !r.path.includes("check_policy"),
  },
  {
    id: "hallucination_risk",
    label: "Possible hallucination",
    desc: "order not found, yet the reply doesn't say so",
    test: (r) =>
      Boolean(r.orderId) && !r.orderFound && !/(couldn't|could not|unable|can't|cannot|not find|double-check|no order)/i.test(r.response),
  },
  {
    id: "injection_unblocked",
    label: "Injection reached the LLM",
    desc: "attack pattern in input, guardrail did not block",
    test: (r) => /(ignore (all |any )?(previous|prior) instructions|system prompt|you are now)/i.test(r.message) && !r.blocked,
  },
  {
    id: "pii_output",
    label: "PII in output",
    desc: "a card-like number appears in the reply",
    test: (r) => /\b(?:\d[ -]?){13,16}\b/.test(r.response),
  },
  { id: "error", label: "Run error", desc: "exception during the run", test: (r) => Boolean(r.error) },
];

const VERSION_BG: Record<VersionId, string> = { v1: "bg-sky-400", v2: "bg-rose-500", v3: "bg-emerald-400" };

const percentile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export default function MonitorPage() {
  const [version, setVersion] = usePersistentState<VersionId>("monitor.version", "v1");
  const [mode, setMode] = usePersistentState<"auto" | "mock">("mode", "auto");
  const [n, setN] = useState(20);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulate() {
    setLoading(true);
    setError(null);
    try {
      const { runs: newRuns } = await postJSON<{ runs: AgentRun[] }>("/api/simulate", { version, mode, n });
      setRuns((r) => [...r, ...newRuns]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const m = useMemo(() => {
    const lat = runs.map((r) => r.trace.totalMs);
    const alerts = runs.flatMap((r) => DETECTORS.filter((d) => d.test(r)).map((d) => ({ d, r })));
    const intents: Record<string, number> = {};
    const nodeLat: Record<string, { sum: number; n: number }> = {};
    for (const r of runs) {
      const key = r.blocked ? "blocked" : r.intent ?? "unknown";
      intents[key] = (intents[key] ?? 0) + 1;
      for (const s of r.trace.spans)
        if (s.kind === "node") {
          const b = (nodeLat[s.name] ??= { sum: 0, n: 0 });
          b.sum += s.durationMs;
          b.n++;
        }
    }
    const perVersion = (["v1", "v2", "v3"] as VersionId[])
      .map((v) => {
        const rs = runs.filter((r) => r.version === v);
        const a = alerts.filter((x) => x.r.version === v);
        return {
          v,
          n: rs.length,
          p95: percentile(rs.map((r) => r.trace.totalMs), 95),
          cost: rs.reduce((s, r) => s + r.trace.costUsd, 0) / (rs.length || 1),
          alertRate: new Set(a.map((x) => x.r.runId)).size / (rs.length || 1),
        };
      })
      .filter((x) => x.n);
    return {
      p50: percentile(lat, 50),
      p95: percentile(lat, 95),
      maxLat: Math.max(1, ...lat),
      avgCost: runs.reduce((s, r) => s + r.trace.costUsd, 0) / (runs.length || 1),
      tokens: runs.reduce((s, r) => s + r.trace.inputTokens + r.trace.outputTokens, 0),
      blockRate: runs.filter((r) => r.blocked).length / (runs.length || 1),
      escRate: runs.filter((r) => r.ticketId).length / (runs.length || 1),
      alerts,
      intents: Object.entries(intents).sort((a, b) => b[1] - a[1]),
      nodeLat: Object.entries(nodeLat)
        .map(([k, v]) => [k, v.sum / v.n] as const)
        .sort((a, b) => b[1] - a[1]),
      perVersion,
    };
  }, [runs]);

  const maxNode = Math.max(1, ...m.nodeLat.map((x) => x[1]));

  return (
    <div>
      <SectionTitle eyebrow="Production · online monitoring" title={<>Live <span className="gradient-text">Ops Dashboard</span></>}>
        Offline evals tell you if a release is good <i>before</i> shipping. Monitoring tells you if it&apos;s <i>still</i> good with real
        users, where there is no ground truth. Simulate traffic, then switch versions mid-stream and watch the detectors fire.
      </SectionTitle>

      <div className="card mb-6 space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="label">Deploy version &amp; send traffic</span>
          <ModeToggle value={mode} onChange={setMode} />
        </div>
        <VersionPicker value={version} onChange={setVersion} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            Requests
            <input type="range" min={5} max={60} step={5} value={n} onChange={(e) => setN(+e.target.value)} className="accent-fuchsia-500" />
            <span className="w-6 font-mono text-ink">{n}</span>
          </label>
          <button className="btn-primary" onClick={simulate} disabled={loading}>
            {loading ? "Sending traffic…" : `🚀 Simulate ${n} requests on ${version}`}
          </button>
          {runs.length > 0 && (
            <button className="btn-ghost" onClick={() => setRuns([])}>
              Reset
            </button>
          )}
          {error && <span className="text-sm text-rose-300">{error}</span>}
          <span className="text-[11px] text-muted">Live mode is capped at 12 requests per burst to protect your budget.</span>
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <div className="mb-2 text-4xl">📡</div>
          No traffic yet. Send 20 requests on <b className="text-ink">v1</b>, then 20 on <b className="text-ink">v2</b>. What does the dashboard tell you?
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Stat label="Requests" value={runs.length} />
            <Stat label="p50 latency" value={fmtMs(m.p50)} tone="from-sky-500/25 to-indigo-500/10" />
            <Stat label="p95 latency" value={fmtMs(m.p95)} tone="from-indigo-500/25 to-violet-500/10" />
            <Stat label="Avg cost / req" value={fmtUsd(m.avgCost)} tone="from-emerald-500/25 to-teal-500/10" />
            <Stat label="Block rate" value={pct(m.blockRate)} sub="guardrail" tone="from-rose-500/25 to-pink-500/10" />
            <Stat label="Escalation rate" value={pct(m.escRate)} sub="human handoff" tone="from-amber-500/25 to-orange-500/10" />
            <Stat
              label="Alerts"
              value={<span className={m.alerts.length ? "text-rose-300" : "text-emerald-300"}>{m.alerts.length}</span>}
              sub="online detectors"
              tone="from-fuchsia-500/25 to-rose-500/10"
            />
          </div>

          <div className="card mt-4 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Request timeline · latency per request</span>
              <span className="flex gap-3 text-[11px] text-muted">
                {(["v1", "v2", "v3"] as VersionId[]).map((v) => (
                  <span key={v} className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${VERSION_BG[v]}`} />
                    {v}
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-300 ring-2 ring-rose-500" /> alert
                </span>
              </span>
            </div>
            <div className="flex h-40 items-end gap-[3px] overflow-x-auto rounded-lg bg-black/20 p-2">
              {runs.map((r) => {
                const alert = DETECTORS.some((d) => d.test(r));
                return (
                  <div
                    key={r.runId}
                    title={`${r.version} · ${fmtMs(r.trace.totalMs)} · ${r.message}`}
                    className={`min-w-[6px] flex-1 rounded-t ${VERSION_BG[r.version]} ${alert ? "outline outline-2 outline-rose-500" : "opacity-80"}`}
                    style={{ height: `${Math.max(4, (r.trace.totalMs / m.maxLat) * 100)}%` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="card p-4">
              <div className="label mb-3">Traffic by intent</div>
              <div className="space-y-2">
                {m.intents.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-xs">
                    <span className="font-mono">{k}</span>
                    <Bar value={v / runs.length} color="from-violet-400 to-fuchsia-500" />
                    <span className="text-right tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <div className="label mb-3">Avg latency by graph node</div>
              <div className="space-y-2">
                {m.nodeLat.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr_52px] items-center gap-2 text-xs">
                    <span className="truncate font-mono">{k}</span>
                    <Bar value={v / maxNode} color="from-sky-400 to-indigo-500" />
                    <span className="text-right font-mono tabular-nums">{fmtMs(v)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <div className="label mb-3">Per-version health</div>
              <table className="w-full text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="text-left">ver</th>
                    <th className="text-right">reqs</th>
                    <th className="text-right">p95</th>
                    <th className="text-right">$/req</th>
                    <th className="text-right">alert rate</th>
                  </tr>
                </thead>
                <tbody>
                  {m.perVersion.map((x) => (
                    <tr key={x.v} className="border-t border-white/5">
                      <td className="py-1.5">
                        <span className={`mr-1 inline-block h-2 w-2 rounded-full ${VERSION_BG[x.v]}`} />
                        {x.v}
                      </td>
                      <td className="text-right tabular-nums">{x.n}</td>
                      <td className="text-right font-mono">{fmtMs(x.p95)}</td>
                      <td className="text-right font-mono">{fmtUsd(x.cost)}</td>
                      <td className={`text-right font-bold ${x.alertRate > 0.05 ? "text-rose-300" : "text-emerald-300"}`}>{pct(x.alertRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="card p-4">
              <div className="label mb-3">Online detectors (no ground truth required)</div>
              <div className="space-y-2">
                {DETECTORS.map((d) => {
                  const hits = m.alerts.filter((a) => a.d.id === d.id).length;
                  return (
                    <div key={d.id} className={`flex items-center gap-3 rounded-lg p-2 ${hits ? "bg-rose-500/10" : "bg-white/[0.03]"}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${hits ? "bg-rose-500 text-white" : "bg-emerald-500/20 text-emerald-300"}`}>
                        {hits || "✓"}
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{d.label}</div>
                        <div className="text-[11px] text-muted">{d.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card p-4">
              <div className="label mb-3">Alert feed: candidates for your next golden test case</div>
              {m.alerts.length === 0 ? (
                <div className="text-sm text-muted">All quiet. 🎉</div>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto">
                  {m.alerts
                    .slice()
                    .reverse()
                    .map(({ d, r }, i) => (
                      <div key={`${r.runId}-${d.id}-${i}`} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-1.5 font-bold text-white ${VERSION_BG[r.version]}`}>{r.version}</span>
                          <span className="font-semibold text-rose-200">{d.label}</span>
                        </div>
                        <div className="mt-1 text-muted">
                          <b className="text-ink">User:</b> {r.message}
                        </div>
                        <div className="text-muted">
                          <b className="text-ink">Agent:</b> {r.response}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            Running {VERSIONS[version].name}. The loop to remember: production alert → add it to <code>dataset.ts</code> → it becomes a regression
            test forever.
          </p>
        </>
      )}
    </div>
  );
}
