import { runAgent } from "@/lib/agent/graph";
import type { VersionId } from "@/lib/agent/versions";

export async function POST(req: Request) {
  const { message, version, mode } = (await req.json()) as { message?: string; version?: VersionId; mode?: string };
  if (!message?.trim()) return Response.json({ error: "message is required" }, { status: 400 });
  const run = await runAgent(message.slice(0, 2000), { version, mode });
  return Response.json(run);
}
