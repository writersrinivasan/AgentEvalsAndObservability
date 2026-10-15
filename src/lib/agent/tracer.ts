// A tiny, dependency-free tracer that mirrors the OpenTelemetry span model.
// Every agent run produces one trace: a tree of spans (node → llm/tool/…).
// Production equivalents: LangSmith, Langfuse, Arize Phoenix, OTel GenAI spans.

export type SpanKind = "agent" | "node" | "llm" | "tool" | "retriever" | "guardrail";

export interface Span {
  id: string;
  parentId: string | null;
  name: string;
  kind: SpanKind;
  startMs: number; // relative to trace start
  endMs: number;
  durationMs: number;
  status: "ok" | "error";
  input?: unknown;
  output?: unknown;
  error?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: number;
  toolCalls: number;
}

let counter = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export class Tracer {
  readonly traceId = newId("trace");
  private readonly t0 = performance.now();
  private readonly spans: Span[] = [];
  private readonly stack: string[] = [];

  /** Wrap any unit of work in a span. Nested calls become child spans. */
  async span<T>(
    name: string,
    kind: SpanKind,
    input: unknown,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    const span: Span = {
      id: newId("span"),
      parentId: this.stack.at(-1) ?? null,
      name,
      kind,
      startMs: this.now(),
      endMs: 0,
      durationMs: 0,
      status: "ok",
      input,
      attributes: {},
    };
    this.spans.push(span);
    this.stack.push(span.id);
    try {
      const out = await fn(span);
      if (span.output === undefined) span.output = out;
      return out;
    } catch (err) {
      span.status = "error";
      span.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.stack.pop();
      span.endMs = this.now();
      span.durationMs = +(span.endMs - span.startMs).toFixed(1);
    }
  }

  private now() {
    return +(performance.now() - this.t0).toFixed(1);
  }

  finish(): Trace {
    const sum = (k: string) =>
      this.spans.reduce((a, s) => a + (typeof s.attributes[k] === "number" ? (s.attributes[k] as number) : 0), 0);
    const root = this.spans.find((s) => s.parentId === null);
    return {
      traceId: this.traceId,
      spans: this.spans,
      totalMs: root?.durationMs ?? this.now(),
      inputTokens: sum("gen_ai.usage.input_tokens"),
      outputTokens: sum("gen_ai.usage.output_tokens"),
      costUsd: +sum("cost_usd").toFixed(6),
      llmCalls: this.spans.filter((s) => s.kind === "llm").length,
      toolCalls: this.spans.filter((s) => s.kind === "tool" || s.kind === "retriever").length,
    };
  }
}
