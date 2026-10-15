import Link from "next/link";
import { DAYS, MODULES } from "@/content/curriculum";

const LOOP = [
  { e: "🛠️", t: "Build", d: "Run a real agent in minute one", c: "from-sky-500 to-indigo-500" },
  { e: "🔭", t: "Observe", d: "Open the trace, see every step", c: "from-amber-400 to-orange-500" },
  { e: "💥", t: "Break", d: "Ship a ‘harmless’ change", c: "from-rose-500 to-pink-500" },
  { e: "📏", t: "Measure", d: "Let evals catch the regression", c: "from-emerald-400 to-teal-500" },
  { e: "🔧", t: "Fix", d: "Prove it’s better with numbers", c: "from-violet-500 to-fuchsia-500" },
  { e: "🧠", t: "Understand", d: "Only now: name the concepts", c: "from-yellow-300 to-amber-500" },
];

const PLACES = [
  { href: "/lab", t: "Agent Lab", d: "Chat with the ShopSmart agent, watch the LangGraph light up, dissect the trace.", e: "🔬", c: "from-sky-500/30 to-indigo-500/10" },
  { href: "/evals", t: "Eval Runner", d: "17 golden cases × 6 evaluators incl. LLM-as-judge. Compare versions, spot regressions.", e: "🧪", c: "from-emerald-500/30 to-teal-500/10" },
  { href: "/monitor", t: "Ops Dashboard", d: "Simulate production traffic. Latency, cost, intents, and online detectors that fire.", e: "📡", c: "from-rose-500/30 to-pink-500/10" },
  { href: "/curriculum", t: "Curriculum", d: "The 5-hour plan: every module is “do first → break it down”, with quizzes.", e: "🗺️", c: "from-amber-500/30 to-orange-500/10" },
];

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative pt-10 text-center">
        <div className="chip mx-auto mb-5 border-fuchsia-400/40 text-fuchsia-200">⚡ Hands-on workshop · 5 hours · LangGraph.js + Claude</div>
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          How do you know your agent is <span className="gradient-text">actually good?</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Agent <b className="text-ink">Evals</b> &amp; <b className="text-ink">Observability</b>, taught backwards. We build and run a real
          customer-support agent first, break it, catch it, fix it, and only then name the theory.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/lab" className="btn-primary px-6 py-3 text-base">
            ▶ Start with the agent
          </Link>
          <Link href="/curriculum" className="btn-ghost px-6 py-3 text-base">
            See the 5-hour plan
          </Link>
        </div>
      </section>

      {/* Method */}
      <section>
        <div className="mb-4 text-center">
          <div className="label">The method</div>
          <h2 className="text-2xl font-extrabold">Reverse engineering: experience → evidence → concept</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {LOOP.map((s, i) => (
            <div key={s.t} className="card relative overflow-hidden p-4">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.c}`} />
              <div className="text-3xl">{s.e}</div>
              <div className="mt-2 text-xs font-mono text-muted">0{i + 1}</div>
              <div className="font-bold">{s.t}</div>
              <div className="text-xs text-muted">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Project */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-2">
          <div>
            <div className="label">The industrial use case</div>
            <h2 className="mt-1 text-3xl font-extrabold">
              ShopSmart <span className="gradient-text">Customer Support Agent</span>
            </h2>
            <p className="mt-3 text-muted">
              An e-commerce support agent that tracks orders, decides refunds against real policy (30-day window, $500 review limit,
              final-sale items), answers product questions from a knowledge base, escalates angry customers to humans, and defends
              against prompt injection and PII leaks. It can cost real money when it&apos;s wrong, which is exactly why evals matter.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["LangGraph StateGraph", "Conditional routing", "Tool calls", "RAG retriever", "Guardrails", "Claude Opus 5.5", "LLM-as-judge", "Offline simulator"].map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {[
              ["v1 · Baseline", "Ships. Good, but has 2 blind spots you’ll discover.", "from-sky-500 to-indigo-500", "88%"],
              ["v2 · Speed Patch", "A “quick win” PR that silently breaks refunds, safety & truthfulness.", "from-rose-500 to-orange-500", "41%"],
              ["v3 · Hardened", "Fixed using evidence from traces and evals.", "from-emerald-500 to-teal-500", "100%"],
            ].map(([n, d, c, s]) => (
              <div key={n} className="flex items-center gap-4 rounded-xl border border-line bg-black/20 p-4">
                <span className={`rounded-lg bg-gradient-to-r ${c} px-2.5 py-1 text-sm font-bold text-white`}>{n}</span>
                <span className="flex-1 text-sm text-muted">{d}</span>
                <span className="font-mono text-sm font-bold" title="Offline-simulator eval pass rate">
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Days */}
      <section className="grid gap-4 md:grid-cols-2">
        {([1, 2] as const).map((d) => (
          <div key={d} className="card relative overflow-hidden p-6">
            <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${DAYS[d].color}`} />
            <div className="label">Day {d} · 2.5 hours</div>
            <h3 className="mt-1 text-2xl font-extrabold">{DAYS[d].title}</h3>
            <p className="text-sm text-muted">{DAYS[d].subtitle}</p>
            <ul className="mt-4 space-y-2">
              {MODULES.filter((m) => m.day === d).map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <span className="w-10 font-mono text-xs text-muted">{m.start}</span>
                  <span className="text-lg">{m.emoji}</span>
                  <span className={m.kind === "break" ? "text-muted" : ""}>{m.title}</span>
                  <span className="ml-auto text-xs text-muted">{m.minutes}m</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* Places */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACES.map((p) => (
          <Link key={p.href} href={p.href} className={`card group bg-gradient-to-br ${p.c} p-5 transition hover:-translate-y-1 hover:border-white/30`}>
            <div className="text-3xl">{p.e}</div>
            <div className="mt-2 font-bold">
              {p.t} <span className="inline-block transition group-hover:translate-x-1">→</span>
            </div>
            <div className="mt-1 text-sm text-muted">{p.d}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
