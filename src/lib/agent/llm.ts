import Anthropic from "@anthropic-ai/sdk";
import type { Tracer } from "./tracer";

// ── Models & pricing ($ per 1M tokens) ─────────────────────────────────────
export const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-opus-5-5";
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "claude-haiku-5-5";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-fable-5-1": { input: 10, output: 50 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICING[model] ?? PRICING["claude-opus-5-5"];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// ── Mode: "live" calls Claude, "mock" is a deterministic offline simulator ──
export type Mode = "live" | "mock";

export function liveAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function resolveMode(requested?: string): Mode {
  if (requested === "mock") return "mock";
  if (process.env.AGENT_MODE === "mock") return "mock";
  return liveAvailable() ? "live" : "mock";
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const estimateTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

export interface LlmCall {
  tracer: Tracer;
  mode: Mode;
  name: string;
  system: string;
  user: string;
  model?: string;
  effort?: "low" | "medium" | "high";
  /** JSON schema → Claude structured outputs; the reply is guaranteed-valid JSON. */
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  /** What the offline simulator answers instead of calling Claude. */
  mock: () => string;
}

/** One LLM call, wrapped in an `llm` span with OTel GenAI-style attributes. */
export async function callLLM(call: LlmCall): Promise<string> {
  const model = call.model ?? AGENT_MODEL;
  return call.tracer.span(
    call.name,
    "llm",
    { system: call.system, user: call.user },
    async (span) => {
      span.attributes["gen_ai.system"] = "anthropic";
      span.attributes["gen_ai.request.model"] = model;
      span.attributes["mode"] = call.mode;

      let text: string;
      let inputTokens: number;
      let outputTokens: number;

      if (call.mode === "mock") {
        text = call.mock();
        inputTokens = estimateTokens(call.system + call.user);
        outputTokens = estimateTokens(text);
        // Simulate realistic model latency so the trace waterfall is meaningful.
        await sleep(120 + outputTokens * 4 + Math.random() * 120);
      } else {
        const response = await createMessage(model, call);
        if (response.stop_reason === "refusal") {
          span.attributes["gen_ai.response.finish_reason"] = "refusal";
          text = call.jsonSchema ? "{}" : "Sorry, I can't help with that request.";
        } else {
          text = response.content
            .flatMap((b) => (b.type === "text" ? [b.text] : []))
            .join("")
            .trim();
          span.attributes["gen_ai.response.finish_reason"] = response.stop_reason ?? "unknown";
        }
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
      }

      span.attributes["gen_ai.usage.input_tokens"] = inputTokens;
      span.attributes["gen_ai.usage.output_tokens"] = outputTokens;
      span.attributes["cost_usd"] = +costUsd(model, inputTokens, outputTokens).toFixed(6);
      span.output = text;
      return text;
    },
  );
}

async function createMessage(model: string, call: LlmCall) {
  const client = getClient();
  const output_config = {
    effort: call.effort ?? "low",
    ...(call.jsonSchema ? { format: { type: "json_schema" as const, schema: call.jsonSchema } } : {}),
  };
  const params = {
    model,
    max_tokens: call.maxTokens ?? 2048,
    system: call.system,
    messages: [{ role: "user" as const, content: call.user }],
    output_config,
  };
  // Server-side refusal fallback is supported on Opus/Sonnet 5.5 (not on Haiku).
  if (model.startsWith("claude-opus") || model.startsWith("claude-sonnet")) {
    return client.beta.messages.create({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  }
  return client.beta.messages.create(params);
}
