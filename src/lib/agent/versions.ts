// Agent "releases". Each version is the same graph with different prompts and
// flags — exactly how real regressions sneak in. Evals exist to catch them.

export type VersionId = "v1" | "v2" | "v3";

export interface AgentVersion {
  id: VersionId;
  name: string;
  tagline: string;
  color: string;
  changes: string[];
  flags: {
    /** v2 "optimisation": skip the policy retriever to save latency. */
    skipPolicyCheck: boolean;
    /** v2 prompt edit: "never say you don't know" → hallucinations. */
    hallucinateOnMissingData: boolean;
    /** v2 removed the input guardrail "because it slowed things down". */
    disableInputGuardrail: boolean;
    /** v3 escalates angry / legal / billing-dispute messages to a human. */
    sentimentEscalation: boolean;
  };
}

export const VERSIONS: Record<VersionId, AgentVersion> = {
  v1: {
    id: "v1",
    name: "v1 · Baseline",
    tagline: "The first version that shipped. Solid, but has blind spots.",
    color: "from-sky-500 to-indigo-500",
    changes: ["Input guardrail", "Intent router", "Policy-checked refunds", "Grounded responses"],
    flags: {
      skipPolicyCheck: false,
      hallucinateOnMissingData: false,
      disableInputGuardrail: false,
      sentimentEscalation: false,
    },
  },
  v2: {
    id: "v2",
    name: "v2 · Speed Patch",
    tagline: "A 'quick win' PR: faster, friendlier… and quietly broken.",
    color: "from-rose-500 to-orange-500",
    changes: [
      "Removed policy retriever (−300ms!)",
      "Prompt: 'never tell the customer you don't know'",
      "Removed input guardrail",
    ],
    flags: {
      skipPolicyCheck: true,
      hallucinateOnMissingData: true,
      disableInputGuardrail: true,
      sentimentEscalation: false,
    },
  },
  v3: {
    id: "v3",
    name: "v3 · Hardened",
    tagline: "Fixed using evidence from traces + evals.",
    color: "from-emerald-500 to-teal-500",
    changes: ["Everything in v1", "Escalates legal threats & billing disputes", "Stricter router prompt"],
    flags: {
      skipPolicyCheck: false,
      hallucinateOnMissingData: false,
      disableInputGuardrail: false,
      sentimentEscalation: true,
    },
  },
};
