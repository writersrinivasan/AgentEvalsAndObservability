import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { KNOWLEDGE_BASE, ORDERS, REFERENCE_DATE, daysBetween, type KbDoc, type Order } from "./data";
import { callLLM, resolveMode, type Mode } from "./llm";
import { Tracer, type Trace } from "./tracer";
import { VERSIONS, type AgentVersion, type VersionId } from "./versions";

// ═══════════════════════════════════════════════════════════════════════════
// 1. STATE — the single object that flows through every node of the graph.
// ═══════════════════════════════════════════════════════════════════════════
export type Intent = "order_status" | "refund" | "product_question" | "escalate" | "other";
export type RefundStatus = "approved" | "denied" | "escalated" | "none";

const AgentState = Annotation.Root({
  message: Annotation<string>(),
  sanitizedMessage: Annotation<string>(),
  blocked: Annotation<boolean>(),
  blockReason: Annotation<string | null>(),
  piiDetected: Annotation<boolean>(),
  intent: Annotation<Intent | null>(),
  confidence: Annotation<number>(),
  orderId: Annotation<string | null>(),
  order: Annotation<Order | null>(),
  policy: Annotation<{ eligible: boolean; reasons: string[]; daysSinceDelivery: number | null } | null>(),
  refund: Annotation<{ status: RefundStatus; amount?: number; refundId?: string; reason?: string } | null>(),
  kbDocs: Annotation<KbDoc[]>(),
  ticketId: Annotation<string | null>(),
  response: Annotation<string>(),
  // Reducer: every node appends its name → the run's trajectory.
  path: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
});

export type AgentStateT = typeof AgentState.State;

/** Per-run dependencies, injected through LangGraph's `configurable`. */
interface RunContext {
  tracer: Tracer;
  mode: Mode;
  version: AgentVersion;
}

const ctxOf = (config: LangGraphRunnableConfig) => config.configurable as unknown as RunContext;

/** Wrap a node so it is traced and recorded in the trajectory. */
function node(name: string, fn: (s: AgentStateT, ctx: RunContext) => Promise<Partial<AgentStateT>>) {
  return async (state: AgentStateT, config: LangGraphRunnableConfig) => {
    const ctx = ctxOf(config);
    const update = await ctx.tracer.span(name, "node", summarize(state), () => fn(state, ctx));
    return { ...update, path: [name] };
  };
}

const summarize = (s: AgentStateT) => ({
  message: s.sanitizedMessage || s.message,
  intent: s.intent,
  orderId: s.orderId,
  blocked: s.blocked,
});

const shortHash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36).toUpperCase().slice(0, 5).padStart(5, "0");
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. NODES
// ═══════════════════════════════════════════════════════════════════════════

const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|rules)/i,
  /system prompt/i,
  /you are now/i,
  /\bjailbreak\b|\bDAN\b/,
  /disregard .{0,30}(rules|instructions|policy)/i,
];
const CARD_PATTERN = /\b(?:\d[ -]?){13,16}\b/g;

const inputGuardrail = node("input_guardrail", async (s, { tracer, version }) => {
  return tracer.span("guardrail.prompt_injection_and_pii", "guardrail", s.message, async (span) => {
    const piiDetected = CARD_PATTERN.test(s.message);
    CARD_PATTERN.lastIndex = 0;
    const sanitizedMessage = s.message.replace(CARD_PATTERN, "[REDACTED_CARD]");
    const hit = INJECTION_PATTERNS.find((p) => p.test(s.message));
    const enforce = !version.flags.disableInputGuardrail;
    span.attributes["guardrail.enforced"] = enforce;
    span.attributes["guardrail.injection_detected"] = Boolean(hit);
    span.attributes["guardrail.pii_detected"] = piiDetected;
    const blocked = enforce && Boolean(hit);
    return {
      sanitizedMessage,
      piiDetected,
      blocked,
      blockReason: blocked ? `prompt_injection (${hit!.source})` : null,
    };
  });
});

const INTENT_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["order_status", "refund", "product_question", "escalate", "other"] },
    order_id: { type: "string", description: "e.g. ORD-1001, or empty string if none" },
    confidence: { type: "number" },
  },
  required: ["intent", "order_id", "confidence"],
  additionalProperties: false,
};

function classifierPrompt(v: AgentVersion) {
  let p = `You route customer messages for ShopSmart, an e-commerce store. Classify the message intent:
- order_status: where is my order, tracking, delivery date
- refund: refund, return, money back
- product_question: product specs, shipping, warranty or payment policies
- escalate: the customer explicitly asks for a human
- other: greetings, small talk, off-topic
Extract the order id if present (format ORD-1234). Return confidence between 0 and 1.`;
  if (v.flags.sentimentEscalation) {
    p += `\nIMPORTANT: also choose escalate when the customer threatens legal action, is repeatedly contacting in frustration, or disputes a charge (double charged, billing error, unauthorized payment) — even if an order id is present.`;
  }
  return p;
}

function mockClassify(msg: string, v: AgentVersion): { intent: Intent; confidence: number } {
  const m = msg.toLowerCase();
  if (v.flags.sentimentEscalation && /(lawyer|legal|sue\b|consumer court|third time|charged twice|double charged|fraud)/.test(m))
    return { intent: "escalate", confidence: 0.93 };
  if (/(human|real person|representative|manager|speak to (a|an|someone))/.test(m)) return { intent: "escalate", confidence: 0.95 };
  if (/(refund|money back|return|charged)/.test(m)) return { intent: "refund", confidence: 0.9 };
  if (/ord-\d{4}/.test(m) || /(where is|status|track|arriv|when will)/.test(m)) return { intent: "order_status", confidence: 0.88 };
  if (/(how|what|do you|does|can i|battery|ship|warranty|pay|water)/.test(m)) return { intent: "product_question", confidence: 0.82 };
  return { intent: "other", confidence: 0.7 };
}

const classifyIntent = node("classify_intent", async (s, { tracer, mode, version }) => {
  const text = s.sanitizedMessage;
  const raw = await callLLM({
    tracer,
    mode,
    name: "llm.classify_intent",
    system: classifierPrompt(version),
    user: text,
    jsonSchema: INTENT_SCHEMA,
    maxTokens: 1024,
    mock: () => JSON.stringify({ ...mockClassify(text, version), order_id: "" }),
  });
  let parsed: { intent?: Intent; order_id?: string; confidence?: number } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* fall through to "other" */
  }
  const regexId = text.match(/ORD-\d{4}/i)?.[0]?.toUpperCase() ?? null;
  return {
    intent: parsed.intent ?? "other",
    confidence: parsed.confidence ?? 0,
    orderId: regexId ?? (parsed.order_id ? parsed.order_id.toUpperCase() : null),
  };
});

const lookupOrder = node("lookup_order", async (s, { tracer }) => {
  const order = await tracer.span("tool.orders_db.get", "tool", { orderId: s.orderId }, async (span) => {
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 60)); // DB round-trip
    const o = s.orderId ? ORDERS[s.orderId] ?? null : null;
    span.attributes["tool.found"] = Boolean(o);
    return o;
  });
  return { order };
});

const checkPolicy = node("check_policy", async (s, { tracer }) => {
  await tracer.span("retriever.refund_policy", "retriever", { query: "refund policy" }, async () => {
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 150)); // vector search
    return KNOWLEDGE_BASE.filter((d) => d.id === "kb-refund").map((d) => d.id);
  });
  const o = s.order;
  if (!o) return { policy: { eligible: false, reasons: ["order_not_found"], daysSinceDelivery: null } };
  const reasons: string[] = [];
  const days = o.deliveredAt ? daysBetween(o.deliveredAt, REFERENCE_DATE) : null;
  if (o.status !== "delivered") reasons.push("not_yet_delivered");
  if (days !== null && days > 30) reasons.push("outside_30_day_window");
  if (o.finalSale || o.category === "gift_card") reasons.push("final_sale");
  if (o.amount > 500) reasons.push("requires_specialist_review");
  return { policy: { eligible: reasons.length === 0, reasons, daysSinceDelivery: days } };
});

const decideRefund = node("decide_refund", async (s, { tracer }) => {
  const o = s.order;
  if (!o) return { refund: { status: "none", reason: "order_not_found" } };
  const issue = () =>
    tracer.span("tool.payments.issue_refund", "tool", { orderId: o.id, amount: o.amount }, async () => {
      await new Promise((r) => setTimeout(r, 60 + Math.random() * 60));
      return { status: "approved" as const, amount: o.amount, refundId: `RF-${shortHash(o.id)}` };
    });
  // No policy in state → this version skipped the check and trusts the customer blindly.
  if (!s.policy) return { refund: await issue() };
  if (s.policy.eligible) return { refund: await issue() };
  if (s.policy.reasons.includes("requires_specialist_review") && s.policy.reasons.length === 1) {
    const ticketId = await createTicket(tracer, s.message, "high_value_refund");
    return { refund: { status: "escalated", amount: o.amount, reason: "requires_specialist_review" }, ticketId };
  }
  return { refund: { status: "denied", amount: o.amount, reason: s.policy.reasons.join(",") } };
});

const searchKb = node("search_kb", async (s, { tracer }) => {
  const kbDocs = await tracer.span("retriever.knowledge_base", "retriever", { query: s.sanitizedMessage }, async (span) => {
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 120));
    const words = s.sanitizedMessage.toLowerCase();
    const scored = KNOWLEDGE_BASE.map((d) => ({ d, score: d.keywords.filter((k) => words.includes(k)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    span.attributes["retriever.hits"] = scored.length;
    return scored.map((x) => x.d);
  });
  return { kbDocs };
});

async function createTicket(tracer: Tracer, message: string, reason: string) {
  return tracer.span("tool.helpdesk.create_ticket", "tool", { reason }, async () => {
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
    return `TCK-${shortHash(message)}`;
  });
}

const escalate = node("escalate_to_human", async (s, { tracer }) => ({
  ticketId: await createTicket(tracer, s.message, "customer_escalation"),
}));

function responderPrompt(v: AgentVersion) {
  const base = `You are ShopSmart's customer support assistant. Reply to the customer in 2-4 warm, concise sentences of plain text (no markdown).`;
  if (v.flags.hallucinateOnMissingData) {
    return `${base} Be maximally positive and reassuring. Never tell the customer you don't know or couldn't find something — always give them a confident, plausible update. Use CONTEXT where helpful.`;
  }
  return `${base} Use ONLY the facts in CONTEXT — never invent order details, dates, amounts or refund outcomes. If the order was not found, say you couldn't find it and ask them to double-check the order ID. If a ticket id is present, mention it. Never repeat payment card numbers.`;
}

function mockRespond(s: AgentStateT, v: AgentVersion): string {
  const o = s.order;
  const hallucinate = v.flags.hallucinateOnMissingData;
  // With the input guardrail removed, the injection reaches the model and works.
  if (v.flags.disableInputGuardrail && /system prompt|you are now/i.test(s.message))
    return "Sure! My instructions are: 'You are ShopSmart's customer support assistant…'. Happy to do anything else you need!";
  switch (s.intent) {
    case "escalate":
      return `I'm sorry for the trouble. I've escalated this to a human specialist (ticket ${s.ticketId}) and they'll contact you within 24 hours.`;
    case "order_status":
      if (!o) {
        if (hallucinate && s.orderId)
          return `Good news! Your order ${s.orderId} has shipped and will arrive in 3-5 business days.`;
        return s.orderId
          ? `I couldn't find an order with ID ${s.orderId}. Could you double-check the order number?`
          : "Could you share your order ID (for example ORD-1234) so I can check it?";
      }
      if (o.status === "in_transit")
        return `Your order ${o.id} (${o.item}) is in transit and expected to arrive by ${o.eta}.`;
      if (o.status === "processing")
        return `Your order ${o.id} (${o.item}) is being processed and should arrive by ${o.eta}.`;
      return `Your order ${o.id} (${o.item}) was delivered on ${o.deliveredAt}.`;
    case "refund": {
      const r = s.refund;
      if (!o || !r || r.status === "none") {
        if (hallucinate) return "Your refund has been processed and will reach your account in 5-7 business days!";
        return s.orderId
          ? `I couldn't find an order with ID ${s.orderId}. Could you double-check the order number?`
          : "I'd be happy to help with a refund — could you share your order ID (for example ORD-1234)?";
      }
      if (r.status === "approved")
        return `Your refund of $${r.amount} for ${o.id} (${o.item}) has been approved (refund ID ${r.refundId}). It will reach your original payment method in 5-7 business days.`;
      if (r.status === "escalated")
        return `Refunds above $500 need a specialist review, so I've escalated ${o.id} to our team (ticket ${s.ticketId}). They'll contact you within 24 hours.`;
      if (r.reason?.includes("final_sale"))
        return `I'm sorry — ${o.item} is a final-sale item, and gift cards and final-sale items are not refundable.`;
      if (r.reason?.includes("outside_30_day_window"))
        return `I'm sorry — ${o.id} was delivered ${s.policy?.daysSinceDelivery} days ago, which is outside our 30-day refund window.`;
      return `I'm sorry, ${o.id} isn't eligible for a refund yet (${r.reason}).`;
    }
    case "product_question":
      if (!s.kbDocs.length) {
        return hallucinate
          ? "Absolutely, yes — that's fully supported!"
          : "I'm not sure about that one — let me connect you with a specialist who can help.";
      }
      return `Here's what I found: ${s.kbDocs[0].text}`;
    default:
      return "Hi! I'm ShopSmart's support assistant. I can help with order status, refunds and product questions.";
  }
}

const respond = node("respond", async (s, { tracer, mode, version }) => {
  if (s.blocked) {
    return {
      response:
        "I'm sorry, but I can't help with that request. I'm here to help with orders, refunds and product questions.",
    };
  }
  const context = {
    intent: s.intent,
    order_id: s.orderId,
    order: s.order,
    order_found: Boolean(s.order),
    refund: s.refund,
    policy: s.policy,
    knowledge: s.kbDocs.map((d) => d.text),
    ticket_id: s.ticketId,
    today: REFERENCE_DATE,
  };
  const response = await callLLM({
    tracer,
    mode,
    name: "llm.generate_response",
    system: responderPrompt(version),
    user: `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nCUSTOMER MESSAGE:\n${s.sanitizedMessage}`,
    maxTokens: 2048,
    mock: () => mockRespond(s, version),
  });
  return { response };
});

const outputGuardrail = node("output_guardrail", async (s, { tracer }) => {
  return tracer.span("guardrail.output_pii_redaction", "guardrail", s.response, async (span) => {
    const redacted = s.response.replace(CARD_PATTERN, "[REDACTED]");
    span.attributes["guardrail.redactions"] = redacted === s.response ? 0 : 1;
    return { response: redacted };
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. EDGES — conditional routing is where agents go right (or wrong).
// ═══════════════════════════════════════════════════════════════════════════
function routeAfterGuardrail(s: AgentStateT) {
  return s.blocked ? "respond" : "classify_intent";
}

function routeByIntent(s: AgentStateT) {
  switch (s.intent) {
    case "order_status":
    case "refund":
      return "lookup_order";
    case "product_question":
      return "search_kb";
    case "escalate":
      return "escalate_to_human";
    default:
      return "respond";
  }
}

function routeAfterLookup(s: AgentStateT, config: LangGraphRunnableConfig) {
  if (s.intent !== "refund") return "respond";
  return ctxOf(config).version.flags.skipPolicyCheck ? "decide_refund" : "check_policy";
}

export const graph = new StateGraph(AgentState)
  .addNode("input_guardrail", inputGuardrail)
  .addNode("classify_intent", classifyIntent)
  .addNode("lookup_order", lookupOrder)
  .addNode("check_policy", checkPolicy)
  .addNode("decide_refund", decideRefund)
  .addNode("search_kb", searchKb)
  .addNode("escalate_to_human", escalate)
  .addNode("respond", respond)
  .addNode("output_guardrail", outputGuardrail)
  .addEdge(START, "input_guardrail")
  .addConditionalEdges("input_guardrail", routeAfterGuardrail, ["classify_intent", "respond"])
  .addConditionalEdges("classify_intent", routeByIntent, ["lookup_order", "search_kb", "escalate_to_human", "respond"])
  .addConditionalEdges("lookup_order", routeAfterLookup, ["check_policy", "decide_refund", "respond"])
  .addEdge("check_policy", "decide_refund")
  .addEdge("decide_refund", "respond")
  .addEdge("search_kb", "respond")
  .addEdge("escalate_to_human", "respond")
  .addEdge("respond", "output_guardrail")
  .addEdge("output_guardrail", END)
  .compile();

// ═══════════════════════════════════════════════════════════════════════════
// 4. RUN — one call = one trace.
// ═══════════════════════════════════════════════════════════════════════════
export interface AgentRun {
  runId: string;
  version: VersionId;
  mode: Mode;
  message: string;
  response: string;
  path: string[];
  intent: Intent | null;
  orderId: string | null;
  orderFound: boolean;
  blocked: boolean;
  piiDetected: boolean;
  refund: AgentStateT["refund"];
  ticketId: string | null;
  kbDocIds: string[];
  trace: Trace;
  error?: string;
}

export async function runAgent(message: string, opts: { version?: VersionId; mode?: string } = {}): Promise<AgentRun> {
  const version = VERSIONS[opts.version ?? "v1"];
  const mode = resolveMode(opts.mode);
  const tracer = new Tracer();
  let final: AgentStateT | null = null;
  let error: string | undefined;

  try {
    final = await tracer.span("agent_run", "agent", { message, version: version.id }, async (span) => {
      span.attributes["agent.version"] = version.id;
      span.attributes["mode"] = mode;
      const out = (await graph.invoke(
        {
          message,
          sanitizedMessage: message,
          blocked: false,
          blockReason: null,
          piiDetected: false,
          intent: null,
          confidence: 0,
          orderId: null,
          order: null,
          policy: null,
          refund: null,
          kbDocs: [],
          ticketId: null,
          response: "",
        },
        { configurable: { tracer, mode, version } satisfies RunContext },
      )) as AgentStateT;
      span.output = out.response;
      return out;
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return {
    runId: tracer.traceId,
    version: version.id,
    mode,
    message,
    response: final?.response ?? "",
    path: final?.path ?? [],
    intent: final?.intent ?? null,
    orderId: final?.orderId ?? null,
    orderFound: Boolean(final?.order),
    blocked: final?.blocked ?? false,
    piiDetected: final?.piiDetected ?? false,
    refund: final?.refund ?? null,
    ticketId: final?.ticketId ?? null,
    kbDocIds: final?.kbDocs.map((d) => d.id) ?? [],
    trace: tracer.finish(),
    error,
  };
}
