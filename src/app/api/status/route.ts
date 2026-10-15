import { connection } from "next/server";
import { AGENT_MODEL, JUDGE_MODEL, liveAvailable, resolveMode } from "@/lib/agent/llm";

export async function GET() {
  await connection(); // read env at request time, not build time
  return Response.json({
    liveAvailable: liveAvailable(),
    defaultMode: resolveMode(),
    agentModel: AGENT_MODEL,
    judgeModel: JUDGE_MODEL,
    langsmith: process.env.LANGSMITH_TRACING === "true",
  });
}
