import { runAgent } from "@/lib/agent/graph";
import { resolveMode } from "@/lib/agent/llm";
import { sampleTraffic } from "@/lib/agent/traffic";
import type { VersionId } from "@/lib/agent/versions";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { version = "v1", mode, n = 20 } = (await req.json()) as { version?: VersionId; mode?: string; n?: number };
  const resolved = resolveMode(mode);
  // Live mode costs real money — keep bursts small.
  const count = Math.max(1, Math.min(resolved === "live" ? 12 : 60, n));
  const messages = sampleTraffic(count);
  const runs = [];
  for (let i = 0; i < messages.length; i += 6) {
    runs.push(...(await Promise.all(messages.slice(i, i + 6).map((m) => runAgent(m, { version, mode: resolved })))));
  }
  return Response.json({ runs });
}
