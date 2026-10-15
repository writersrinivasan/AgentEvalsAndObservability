import { runEvalSuite } from "@/lib/evals/runner";
import type { VersionId } from "@/lib/agent/versions";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { version = "v1", mode, judge = true } = (await req.json()) as { version?: VersionId; mode?: string; judge?: boolean };
  const report = await runEvalSuite({ version, mode, judge });
  return Response.json(report);
}
