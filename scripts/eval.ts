// CLI eval runner — the same suite as the /evals page, built for CI.
//   npm run eval -- v1                 run suite against v1
//   npm run eval -- v2 --threshold 0.9 fail (exit 1) below 90% pass rate
//   npm run eval -- v3 --mock --no-judge
import { runEvalSuite } from "../src/lib/evals/runner";
import type { VersionId } from "../src/lib/agent/versions";

const args = process.argv.slice(2);
const version = (args.find((a) => /^v\d$/.test(a)) ?? "v1") as VersionId;
const thIdx = args.indexOf("--threshold");
const threshold = thIdx >= 0 ? Number(args[thIdx + 1]) : 0.85;

const c = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", bold: "\x1b[1m", reset: "\x1b[0m" };

async function main() {
  const report = await runEvalSuite({ version, mode: args.includes("--mock") ? "mock" : undefined, judge: !args.includes("--no-judge") });
  const s = report.summary;
  console.log(`\n${c.bold}${c.cyan}ShopSmart agent eval · ${version} · ${report.mode} mode${c.reset}\n`);
  for (const cr of report.cases) {
    const fails = cr.results.filter((r) => !r.pass);
    console.log(`${cr.pass ? c.green + "✔" : c.red + "✘"} ${cr.case.id.padEnd(6)}${c.reset} ${cr.case.input.slice(0, 60).padEnd(62)} ${c.dim}${cr.run.trace.totalMs.toFixed(0)}ms${c.reset}`);
    for (const f of fails) console.log(`     ${c.yellow}↳ ${f.evaluator}: ${f.detail}${c.reset}`);
  }
  console.log(`\n${c.bold}By evaluator${c.reset}`);
  for (const [k, v] of Object.entries(s.byEvaluator)) console.log(`  ${k.padEnd(16)} ${(v.passRate * 100).toFixed(0).padStart(3)}%  (${v.n} cases)`);
  const ok = s.passRate >= threshold;
  console.log(`\n${c.bold}Pass rate ${(s.passRate * 100).toFixed(1)}%${c.reset} (${s.passed}/${s.total}) · p50 ${s.p50Ms.toFixed(0)}ms · p95 ${s.p95Ms.toFixed(0)}ms · agent $${s.agentCostUsd.toFixed(4)} · judge $${s.judgeCostUsd.toFixed(4)}`);
  console.log(ok ? `${c.green}${c.bold}✅ QUALITY GATE PASSED${c.reset} (threshold ${threshold * 100}%)\n` : `${c.red}${c.bold}⛔ QUALITY GATE FAILED${c.reset} — below ${threshold * 100}%. Do not ship ${version}.\n`);
  process.exit(ok ? 0 : 1);
}
main();
