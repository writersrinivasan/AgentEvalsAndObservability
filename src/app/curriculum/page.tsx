"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, SectionTitle } from "@/components/ui";
import { DAYS, MODULES, type Module } from "@/content/curriculum";
import { usePersistentState } from "@/lib/client";

export default function CurriculumPage() {
  const [day, setDay] = usePersistentState<1 | 2>("curriculum.day", 1);
  const [done, setDone] = usePersistentState<string[]>("curriculum.done", []);
  const [open, setOpen] = useState<string | null>(null);

  const mods = MODULES.filter((m) => m.day === day);
  const learnable = mods.filter((m) => m.kind === "module");
  const progress = learnable.filter((m) => done.includes(m.id)).length / (learnable.length || 1);
  const toggleDone = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  return (
    <div>
      <SectionTitle eyebrow="5 hours · 2 days × 2.5h · build-first" title={<>The <span className="gradient-text">Curriculum</span></>}>
        Every module has the same rhythm: <b className="text-sky-300">▶ Do first</b> in the app (no theory), then{" "}
        <b className="text-amber-300">🔍 Break it down</b>, naming the concepts you just experienced.
      </SectionTitle>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {([1, 2] as const).map((d) => {
          const total = MODULES.filter((m) => m.day === d).reduce((a, m) => a + m.minutes, 0);
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`relative overflow-hidden rounded-2xl border p-5 text-left transition ${day === d ? "border-white/40" : "border-line opacity-70 hover:opacity-100"}`}
            >
              <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${DAYS[d].color} ${day === d ? "opacity-30" : "opacity-10"}`} />
              <div className="label">
                Day {d} · {total} min
              </div>
              <div className="mt-1 text-xl font-extrabold">{DAYS[d].title}</div>
              <div className="text-sm text-muted">{DAYS[d].subtitle}</div>
            </button>
          );
        })}
      </div>

      <div className="card mb-6 flex items-center gap-4 p-4">
        <span className="label shrink-0">Day {day} progress</span>
        <Bar value={progress} color={day === 1 ? "from-fuchsia-500 to-sky-500" : "from-amber-400 to-rose-500"} />
        <span className="shrink-0 text-sm font-bold tabular-nums">{Math.round(progress * 100)}%</span>
      </div>

      <ol className="relative space-y-4 border-l-2 border-dashed border-white/10 pl-6">
        {mods.map((m) => (
          <ModuleCard key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} done={done.includes(m.id)} onDone={() => toggleDone(m.id)} />
        ))}
      </ol>
    </div>
  );
}

function ModuleCard({ m, open, onToggle, done, onDone }: { m: Module; open: boolean; onToggle: () => void; done: boolean; onDone: () => void }) {
  if (m.kind === "break") {
    return (
      <li className="relative">
        <span className="absolute -left-[33px] top-3 grid h-4 w-4 place-items-center rounded-full bg-slate-500" />
        <div className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
          <span className="font-mono">{m.start}</span> · {m.minutes} min · ☕ Break: stretch, refill, keep the app open
        </div>
      </li>
    );
  }
  return (
    <li className="relative">
      <span className={`absolute -left-[35px] top-5 h-5 w-5 rounded-full bg-gradient-to-br ${m.color} ring-4 ring-bg`} />
      <div className={`card overflow-hidden ${open ? "ring-1 ring-white/20" : ""}`}>
        <button onClick={onToggle} className="flex w-full items-start gap-4 p-4 text-left">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${m.color} text-2xl`}>{m.emoji}</span>
          <span className="flex-1">
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-mono">{m.start}</span>
              <span className="chip">{m.minutes} min</span>
              {done && <span className="chip border-emerald-400/40 text-emerald-300">✓ done</span>}
            </span>
            <span className="mt-1 block text-lg font-bold">{m.title}</span>
            {m.hook && <span className="mt-0.5 block text-sm text-muted">{m.hook}</span>}
          </span>
          <span className={`mt-2 text-muted transition ${open ? "rotate-180" : ""}`}>▾</span>
        </button>

        {open && (
          <div className="space-y-5 border-t border-line p-5">
            {m.doFirst && (
              <section className="rounded-xl border border-sky-400/20 bg-sky-500/[0.07] p-4">
                <div className="mb-2 text-sm font-extrabold text-sky-300">▶ DO FIRST: hands-on, no theory yet</div>
                <ol className="space-y-2">
                  {m.doFirst.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-500/30 text-xs font-bold">{i + 1}</span>
                      <span className="flex-1">
                        {s.step}
                        {s.link && (
                          <Link href={s.link.href} className="ml-2 inline-block rounded-md bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30">
                            {s.link.label} →
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {m.breakDown && (
              <section>
                <div className="mb-2 text-sm font-extrabold text-amber-300">🔍 BREAK IT DOWN: now name what you just saw</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {m.breakDown.map((c) => (
                    <div key={c.term} className="rounded-xl border border-amber-400/15 bg-amber-500/[0.05] p-3">
                      <div className="font-semibold text-amber-200">{c.term}</div>
                      <div className="mt-1 text-sm leading-relaxed text-muted">{c.body}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {m.codeRefs && (
                <section>
                  <div className="label mb-2">📂 Code to read</div>
                  <ul className="space-y-1.5">
                    {m.codeRefs.map((c) => (
                      <li key={c.file} className="rounded-lg bg-black/30 px-3 py-2 text-xs">
                        <code className="text-emerald-300">{c.file}</code>
                        <div className="text-muted">{c.why}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {m.discuss && (
                <section>
                  <div className="label mb-2">💬 Discuss</div>
                  <ul className="space-y-1.5 text-sm">
                    {m.discuss.map((d) => (
                      <li key={d} className="rounded-lg bg-violet-500/10 px-3 py-2">
                        {d}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {m.quiz && <Quiz q={m.quiz} />}

            {m.resources && (
              <section>
                <div className="label mb-2">📚 Go deeper</div>
                <div className="flex flex-wrap gap-2">
                  {m.resources.map((r) => (
                    <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="chip hover:border-fuchsia-400/50 hover:text-ink">
                      {r.title} ↗
                    </a>
                  ))}
                </div>
              </section>
            )}

            <button onClick={onDone} className={done ? "btn-ghost" : "btn-primary"}>
              {done ? "↺ Mark as not done" : "✓ Mark module complete"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function Quiz({ q }: { q: NonNullable<Module["quiz"]> }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <section className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-4">
      <div className="mb-2 text-sm font-extrabold text-fuchsia-300">✅ Checkpoint</div>
      <div className="mb-3 text-sm font-medium">{q.q}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const state = pick === null ? "" : i === q.answer ? "border-emerald-400 bg-emerald-500/15" : i === pick ? "border-rose-400 bg-rose-500/15" : "opacity-50";
          return (
            <button key={o} onClick={() => setPick(i)} className={`rounded-lg border border-line px-3 py-2 text-left text-sm transition hover:bg-panel-strong ${state}`}>
              {o}
            </button>
          );
        })}
      </div>
      {pick !== null && (
        <div className={`mt-3 text-sm ${pick === q.answer ? "text-emerald-300" : "text-rose-300"}`}>
          {pick === q.answer ? "Correct! " : "Not quite. "}
          <span className="text-muted">{q.why}</span>
        </div>
      )}
    </section>
  );
}
