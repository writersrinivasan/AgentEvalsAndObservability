"use client";

import { useMemo, useState } from "react";
import { KIND_STYLE, fmtMs, fmtUsd, type Span, type Trace } from "@/lib/client";

export function TraceWaterfall({ trace }: { trace: Trace }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => {
    const depth = new Map<string, number>();
    return trace.spans.map((s) => {
      const d = s.parentId ? (depth.get(s.parentId) ?? 0) + 1 : 0;
      depth.set(s.id, d);
      return { span: s, depth: d };
    });
  }, [trace]);
  const total = Math.max(trace.totalMs, 1);
  const selected = trace.spans.find((s) => s.id === selectedId) ?? null;
  const slowest = [...trace.spans].filter((s) => s.kind !== "agent" && s.kind !== "node").sort((a, b) => b.durationMs - a.durationMs)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="label">Trace waterfall</span>
          <span className="font-mono text-[11px] text-muted">{trace.traceId}</span>
        </div>
        <div className="max-h-[440px] overflow-y-auto py-1">
          {rows.map(({ span, depth }) => {
            const st = KIND_STYLE[span.kind];
            const leftPct = (span.startMs / total) * 100;
            const widthPct = Math.max((span.durationMs / total) * 100, 0.6);
            const isSel = span.id === selectedId;
            return (
              <button
                key={span.id}
                onClick={() => setSelectedId(isSel ? null : span.id)}
                className={`grid w-full grid-cols-[minmax(0,210px)_1fr_64px] items-center gap-2 px-3 py-1 text-left text-xs transition hover:bg-panel-strong ${isSel ? "bg-panel-strong" : ""}`}
              >
                <span className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 12 }}>
                  <span className={`shrink-0 rounded px-1 font-mono text-[9px] uppercase ${st.text} bg-white/5`}>{st.label}</span>
                  <span className="truncate font-mono">{span.name}</span>
                  {span === slowest && <span title="Slowest leaf span">🐢</span>}
                  {span.status === "error" && <span className="text-rose-400">●</span>}
                </span>
                <span className="relative h-4 rounded bg-white/[0.03]">
                  <span className={`absolute top-0.5 h-3 rounded ${st.bar}`} style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                </span>
                <span className="text-right font-mono tabular-nums text-muted">{fmtMs(span.durationMs)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-muted">
          {Object.entries(KIND_STYLE).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`h-2 w-3 rounded ${v.bar}`} />
              {k}
            </span>
          ))}
        </div>
      </div>
      <SpanInspector span={selected} />
    </div>
  );
}

function SpanInspector({ span }: { span: Span | null }) {
  if (!span)
    return (
      <div className="card grid place-items-center p-6 text-center text-sm text-muted">
        <div>
          <div className="mb-2 text-3xl">🔎</div>
          Click any span to inspect its <b className="text-ink">inputs, outputs and attributes</b>.
          <div className="mt-2 text-xs">Tip: start with the amber <span className="text-amber-300">llm</span> spans: that&apos;s where tokens and cost live.</div>
        </div>
      </div>
    );
  const st = KIND_STYLE[span.kind];
  return (
    <div className="card flex max-h-[520px] flex-col overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <div className={`font-mono text-[10px] uppercase ${st.text}`}>{span.kind} span</div>
        <div className="font-mono text-sm font-semibold">{span.name}</div>
        <div className="mt-1 text-xs text-muted">
          {fmtMs(span.durationMs)} · started at +{fmtMs(span.startMs)} · status{" "}
          <span className={span.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{span.status}</span>
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto p-4 text-xs">
        {Object.keys(span.attributes).length > 0 && (
          <div>
            <div className="label mb-1">Attributes</div>
            <table className="w-full font-mono">
              <tbody>
                {Object.entries(span.attributes).map(([k, v]) => (
                  <tr key={k} className="border-b border-white/5">
                    <td className="py-1 pr-2 text-muted">{k}</td>
                    <td className="py-1 text-right text-ink">{k === "cost_usd" ? fmtUsd(v as number) : String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {span.error && <Block title="Error" value={span.error} tone="text-rose-300" />}
        <Block title="Input" value={span.input} />
        <Block title="Output" value={span.output} />
      </div>
    </div>
  );
}

function Block({ title, value, tone = "text-ink" }: { title: string; value: unknown; tone?: string }) {
  if (value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <pre className={`max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 text-[11px] leading-relaxed ${tone}`}>{text}</pre>
    </div>
  );
}
