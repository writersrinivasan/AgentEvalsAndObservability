"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStatus } from "@/lib/client";

const LINKS = [
  { href: "/", label: "Home", dot: "bg-fuchsia-400" },
  { href: "/curriculum", label: "Curriculum", dot: "bg-amber-400" },
  { href: "/lab", label: "Agent Lab", dot: "bg-sky-400" },
  { href: "/evals", label: "Evals", dot: "bg-emerald-400" },
  { href: "/monitor", label: "Monitor", dot: "bg-rose-400" },
  { href: "/resources", label: "Resources", dot: "bg-violet-400" },
];

export function Nav() {
  const path = usePathname();
  const status = useStatus();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-amber-400 to-sky-500 text-sm text-black">
            ◎
          </span>
          <span className="hidden sm:inline">
            EvalOps <span className="gradient-text">Lab</span>
          </span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                  active ? "bg-panel-strong text-ink" : "text-muted hover:text-ink"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} />
                {l.label}
              </Link>
            );
          })}
        </nav>
        {status && (
          <span
            title={status.liveAvailable ? `Agent: ${status.agentModel} · Judge: ${status.judgeModel}` : "No ANTHROPIC_API_KEY — using the offline simulator"}
            className={`chip shrink-0 ${status.defaultMode === "live" ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.defaultMode === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
            {status.defaultMode === "live" ? "LIVE · Claude" : "MOCK · offline"}
          </span>
        )}
      </div>
    </header>
  );
}
