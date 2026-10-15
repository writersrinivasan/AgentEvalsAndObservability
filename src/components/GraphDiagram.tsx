"use client";

import { useEffect, useState } from "react";

type Kind = "guardrail" | "llm" | "tool" | "retriever" | "terminal";

const NODES: Record<string, { x: number; y: number; kind: Kind; label?: string }> = {
  __start__: { x: 40, y: 150, kind: "terminal", label: "START" },
  input_guardrail: { x: 150, y: 150, kind: "guardrail" },
  classify_intent: { x: 290, y: 150, kind: "llm" },
  lookup_order: { x: 440, y: 60, kind: "tool" },
  search_kb: { x: 440, y: 150, kind: "retriever" },
  escalate_to_human: { x: 440, y: 240, kind: "tool" },
  check_policy: { x: 590, y: 60, kind: "retriever" },
  decide_refund: { x: 740, y: 60, kind: "tool" },
  respond: { x: 740, y: 170, kind: "llm" },
  output_guardrail: { x: 740, y: 270, kind: "guardrail" },
  __end__: { x: 740, y: 350, kind: "terminal", label: "END" },
};

const W = 124;
const H = 34;

const KIND_FILL: Record<Kind, [string, string]> = {
  guardrail: ["#f43f5e", "#ec4899"],
  llm: ["#f59e0b", "#f97316"],
  tool: ["#10b981", "#14b8a6"],
  retriever: ["#84cc16", "#22c55e"],
  terminal: ["#8b5cf6", "#d946ef"],
};

const right = (n: string) => [NODES[n].x + W / 2, NODES[n].y] as const;
const left = (n: string) => [NODES[n].x - W / 2, NODES[n].y] as const;
const bez = (a: readonly number[], b: readonly number[]) => {
  const dx = (b[0] - a[0]) / 2;
  return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`;
};

const EDGES: { from: string; to: string; d: string; label?: string }[] = [
  { from: "__start__", to: "input_guardrail", d: `M58,150 L${150 - W / 2},150` },
  { from: "input_guardrail", to: "classify_intent", d: bez(right("input_guardrail"), left("classify_intent")) },
  { from: "input_guardrail", to: "respond", d: "M150,167 C150,395 640,395 700,187", label: "blocked" },
  { from: "classify_intent", to: "lookup_order", d: bez(right("classify_intent"), left("lookup_order")) },
  { from: "classify_intent", to: "search_kb", d: bez(right("classify_intent"), left("search_kb")) },
  { from: "classify_intent", to: "escalate_to_human", d: bez(right("classify_intent"), left("escalate_to_human")) },
  { from: "classify_intent", to: "respond", d: "M290,167 C290,330 600,330 690,185", label: "other" },
  { from: "lookup_order", to: "check_policy", d: bez(right("lookup_order"), left("check_policy")) },
  { from: "lookup_order", to: "decide_refund", d: "M440,43 C440,-2 740,-2 740,43", label: "skip policy (v2)" },
  { from: "lookup_order", to: "respond", d: "M502,66 C600,110 610,168 678,168" },
  { from: "check_policy", to: "decide_refund", d: bez(right("check_policy"), left("decide_refund")) },
  { from: "decide_refund", to: "respond", d: "M740,77 L740,153" },
  { from: "search_kb", to: "respond", d: bez(right("search_kb"), [678, 172]) },
  { from: "escalate_to_human", to: "respond", d: bez(right("escalate_to_human"), [678, 176]) },
  { from: "respond", to: "output_guardrail", d: "M740,187 L740,253" },
  { from: "output_guardrail", to: "__end__", d: "M740,287 L740,332" },
];

export function GraphDiagram({ path, runKey }: { path: string[]; runKey?: string }) {
  const full = path.length ? ["__start__", ...path, "__end__"] : [];
  const [step, setStep] = useState(full.length);
  const [shownKey, setShownKey] = useState(runKey);

  // Replay the trajectory node-by-node whenever a new run arrives.
  if (runKey !== shownKey) {
    setShownKey(runKey);
    setStep(1);
  }
  const total = full.length;
  useEffect(() => {
    if (!total) return;
    const id = setInterval(() => setStep((s) => (s >= total ? (clearInterval(id), s) : s + 1)), 260);
    return () => clearInterval(id);
  }, [runKey, total]);

  const shown = full.slice(0, step);
  const visitedEdges = new Set(shown.slice(1).map((n, i) => `${shown[i]}→${n}`));
  const current = shown.at(-1);

  return (
    <svg viewBox="-10 -10 840 410" className="h-auto w-full" role="img" aria-label="LangGraph state graph">
      <defs>
        {Object.entries(KIND_FILL).map(([k, [a, b]]) => (
          <linearGradient key={k} id={`g-${k}`} x1="0" x2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        ))}
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.35)" />
        </marker>
        <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
        </marker>
      </defs>

      {EDGES.map((e) => {
        const on = visitedEdges.has(`${e.from}→${e.to}`);
        return (
          <g key={`${e.from}-${e.to}`}>
            <path
              d={e.d}
              fill="none"
              stroke={on ? "#fde047" : "rgba(255,255,255,0.14)"}
              strokeWidth={on ? 2.5 : 1.3}
              className={on ? "edge-active" : ""}
              markerEnd={on ? "url(#arrow-on)" : "url(#arrow)"}
            />
            {e.label && (
              <text
                x={e.label === "blocked" ? 400 : e.label === "other" ? 470 : 590}
                y={e.label === "blocked" ? 362 : e.label === "other" ? 300 : 12}
                fontSize="10"
                textAnchor="middle"
                fill={on ? "#fde047" : "rgba(255,255,255,0.35)"}
                fontFamily="var(--font-mono)"
              >
                {e.label}
              </text>
            )}
          </g>
        );
      })}

      {Object.entries(NODES).map(([id, n]) => {
        const visitedIdx = shown.indexOf(id);
        const on = visitedIdx >= 0;
        const isCurrent = current === id;
        if (n.kind === "terminal") {
          return (
            <g key={id}>
              <circle cx={n.x} cy={n.y} r={18} fill={on ? "url(#g-terminal)" : "rgba(255,255,255,0.06)"} stroke="rgba(255,255,255,0.2)" />
              <text x={n.x} y={n.y + 3.5} fontSize="9" fontWeight="700" textAnchor="middle" fill="white">
                {n.label}
              </text>
            </g>
          );
        }
        return (
          <g key={id}>
            {isCurrent && (
              <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={10} fill="none" stroke="#fde047" className="node-active-ring" />
            )}
            <rect
              x={n.x - W / 2}
              y={n.y - H / 2}
              width={W}
              height={H}
              rx={10}
              fill={on ? `url(#g-${n.kind})` : "rgba(255,255,255,0.05)"}
              stroke={on ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.16)"}
            />
            <text x={n.x} y={n.y + 4} fontSize="11" textAnchor="middle" fill={on ? "#0b0b1a" : "rgba(255,255,255,0.7)"} fontWeight={on ? 700 : 500} fontFamily="var(--font-mono)">
              {id}
            </text>
            {on && (
              <g>
                <circle cx={n.x - W / 2} cy={n.y - H / 2} r={9} fill="#0b0b1a" stroke="#fde047" />
                <text x={n.x - W / 2} y={n.y - H / 2 + 3.5} fontSize="9" textAnchor="middle" fill="#fde047" fontWeight="700">
                  {visitedIdx}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const GRAPH_LEGEND: { kind: Kind; label: string }[] = [
  { kind: "guardrail", label: "Guardrail (code)" },
  { kind: "llm", label: "LLM call" },
  { kind: "tool", label: "Tool / action" },
  { kind: "retriever", label: "Retriever" },
];

export function GraphLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted">
      {GRAPH_LEGEND.map((l) => (
        <span key={l.kind} className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded" style={{ background: `linear-gradient(90deg, ${KIND_FILL[l.kind][0]}, ${KIND_FILL[l.kind][1]})` }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
