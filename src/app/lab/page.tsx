"use client";

import { useEffect, useState } from "react";
import { GraphDiagram, GraphLegend } from "@/components/GraphDiagram";
import { TraceWaterfall } from "@/components/TraceView";
import { ModeToggle, SectionTitle, Stat, VersionPicker } from "@/components/ui";
import { SAMPLE_PROMPTS, fmtMs, fmtUsd, postJSON, usePersistentState, type AgentRun } from "@/lib/client";
import type { VersionId } from "@/lib/agent/versions";

export default function LabPage() {
  const [version, setVersion] = usePersistentState<VersionId>("lab.version", "v1");
  const [mode, setMode] = usePersistentState<"auto" | "mock">("mode", "auto");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [history, setHistory] = useState<AgentRun[]>([]);

  // Deep link from the evals page: /lab#q=...&v=v2
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const q = params.get("q");
    const v = params.get("v") as VersionId | null;
    // Syncing from an external system (the URL) once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setMessage(q);
    if (v) setVersion(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text = message) {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await postJSON<AgentRun>("/api/agent", { message: text, version, mode });
      setRun(r);
      setHistory((h) => [r, ...h].slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionTitle eyebrow="Hands-on · Step 1: build & run first" title={<>ShopSmart <span className="gradient-text">Support Agent</span> Lab</>}>
        A production-style LangGraph agent for an e-commerce company. Send it a message, watch it walk the graph, then open the
        trace to see <i>exactly</i> what happened. We&apos;ll explain the theory after you&apos;ve seen it work (and fail).
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        {/* ── Left: controls ── */}
        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="label">Agent version</span>
              <ModeToggle value={mode} onChange={setMode} />
            </div>
            <VersionPicker value={version} onChange={setVersion} />
          </div>

          <div className="card space-y-3 p-4">
            <span className="label">Try a scenario</span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setMessage(p.text);
                    send(p.text);
                  }}
                  disabled={loading}
                  className="rounded-full border border-line bg-panel px-3 py-1 text-xs hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2"
            >
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a customer message… e.g. Where is ORD-1006?"
                className="flex-1 rounded-xl border border-line bg-black/30 px-3 py-2 text-sm outline-none focus:border-fuchsia-400/60"
              />
              <button className="btn-primary" disabled={loading || !message.trim()}>
                {loading ? "Running…" : "Run agent ▶"}
              </button>
            </form>
            {error && <div className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">{error}</div>}
          </div>

          {run && (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="label">Conversation</span>
                <span className="chip">
                  {run.version} · {run.mode}
                </span>
              </div>
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-sky-500/30 to-indigo-500/30 px-3 py-2 text-sm">
                {run.message}
              </div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-line bg-panel-strong px-3 py-2 text-sm">
                {run.error ? <span className="text-rose-300">Error: {run.error}</span> : run.response}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="chip">intent: {run.intent ?? "—"}</span>
                {run.orderId && <span className="chip">order: {run.orderId} {run.orderFound ? "✓" : "✗ not found"}</span>}
                {run.refund && run.refund.status !== "none" && <span className="chip">refund: {run.refund.status}</span>}
                {run.blocked && <span className="chip border-rose-400/40 text-rose-300">🛡 blocked</span>}
                {run.piiDetected && <span className="chip border-amber-400/40 text-amber-300">PII redacted</span>}
                {run.ticketId && <span className="chip">ticket: {run.ticketId}</span>}
              </div>
            </div>
          )}

          {history.length > 1 && (
            <div className="card p-4">
              <span className="label">Run history (this session)</span>
              <div className="mt-2 space-y-1">
                {history.map((h) => (
                  <button
                    key={h.runId}
                    onClick={() => setRun(h)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-panel-strong ${h.runId === run?.runId ? "bg-panel-strong" : ""}`}
                  >
                    <span className="chip">{h.version}</span>
                    <span className="flex-1 truncate">{h.message}</span>
                    <span className="font-mono text-muted">{fmtMs(h.trace.totalMs)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: graph + metrics ── */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label">LangGraph · live trajectory</span>
              <GraphLegend />
            </div>
            <GraphDiagram path={run?.path ?? []} runKey={run?.runId} />
            {run && (
              <div className="mt-2 rounded-lg bg-black/30 p-2 font-mono text-[11px] text-amber-200">
                path = [{run.path.map((p) => `"${p}"`).join(", ")}]
              </div>
            )}
          </div>
          {run && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Latency" value={fmtMs(run.trace.totalMs)} tone="from-sky-500/25 to-indigo-500/10" />
              <Stat label="Tokens" value={run.trace.inputTokens + run.trace.outputTokens} sub={`${run.trace.inputTokens} in · ${run.trace.outputTokens} out`} tone="from-amber-500/25 to-orange-500/10" />
              <Stat label="Cost" value={fmtUsd(run.trace.costUsd)} sub={run.mode === "mock" ? "simulated" : "actual"} tone="from-emerald-500/25 to-teal-500/10" />
              <Stat label="Calls" value={`${run.trace.llmCalls} / ${run.trace.toolCalls}`} sub="LLM / tool" tone="from-fuchsia-500/25 to-pink-500/10" />
            </div>
          )}
        </div>
      </div>

      {run && (
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="label">Step 2 · Observe</div>
              <h2 className="text-xl font-bold">What actually happened inside?</h2>
            </div>
          </div>
          <TraceWaterfall key={run.runId} trace={run.trace} />
        </div>
      )}

      {!run && (
        <div className="card mt-6 grid gap-4 p-6 sm:grid-cols-3">
          {[
            ["1 · Run", "Click a scenario chip. Watch the graph light up node by node.", "from-sky-500 to-indigo-500"],
            ["2 · Inspect", "Open the trace. Click the amber LLM span: prompt, tokens, cost.", "from-amber-400 to-orange-500"],
            ["3 · Break", "Switch to v2 · Speed Patch and replay the same message. Spot the difference.", "from-rose-500 to-pink-500"],
          ].map(([t, d, c]) => (
            <div key={t}>
              <div className={`mb-2 h-1.5 w-12 rounded-full bg-gradient-to-r ${c}`} />
              <div className="font-bold">{t}</div>
              <div className="text-sm text-muted">{d}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
