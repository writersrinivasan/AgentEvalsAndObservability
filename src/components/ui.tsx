"use client";

import type { ReactNode } from "react";
import { VERSIONS, type VersionId } from "@/lib/agent/versions";
import { useStatus } from "@/lib/client";

export function VersionPicker({ value, onChange }: { value: VersionId; onChange: (v: VersionId) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {Object.values(VERSIONS).map((v) => {
        const on = v.id === value;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={`rounded-xl border p-3 text-left transition ${on ? "border-white/40 bg-panel-strong" : "border-line bg-panel hover:bg-panel-strong"}`}
          >
            <div className={`mb-1 inline-block rounded-md bg-gradient-to-r ${v.color} px-2 py-0.5 text-xs font-bold text-white`}>{v.name}</div>
            <div className="text-xs leading-snug text-muted">{v.tagline}</div>
          </button>
        );
      })}
    </div>
  );
}

export function ModeToggle({ value, onChange }: { value: "auto" | "mock"; onChange: (v: "auto" | "mock") => void }) {
  const status = useStatus();
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted">Model:</span>
      <div className="flex rounded-lg border border-line bg-panel p-0.5">
        {(["auto", "mock"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`rounded-md px-2.5 py-1 font-semibold ${value === m ? "bg-white/15 text-ink" : "text-muted"}`}
          >
            {m === "auto" ? (status?.liveAvailable ? `Live · ${status.agentModel}` : "Auto (no key → offline)") : "Offline simulator"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone = "from-fuchsia-500/20 to-sky-500/10" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`card bg-gradient-to-br ${tone} p-4`}>
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="label mb-2">{eyebrow}</div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-3xl text-muted">{children}</p>}
    </div>
  );
}

export function Bar({ value, color = "from-emerald-400 to-teal-500" }: { value: number; color?: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export const scoreColor = (v: number) =>
  v >= 0.9 ? "from-emerald-400 to-teal-500" : v >= 0.7 ? "from-amber-300 to-orange-500" : "from-rose-500 to-pink-500";

export function Ring({ value, size = 132 }: { value: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const color = value >= 0.9 ? "#34d399" : value >= 0.7 ? "#fbbf24" : "#fb7185";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4.4} fontWeight="800" fill="white">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}
