import { AiExtractionError, extractDiscovery } from "./discovery.js";
import type { ModelInput, ModelOutput, ModelProvider } from "./provider.js";

const validExtraction = {
  requirements: [{ description: "The team can approve a request", category: "functional", priority: "high" }],
  risks: [{ description: "Approval ownership is unclear", impact: "medium" }],
  decisions: [{ description: "The delivery lead owns approval routing" }],
  open_items: [{ description: "Confirm the escalation window", owner: "Operations" }],
  scope_boundary: {
    in_scope: ["Approval routing"],
    out_of_scope: ["Billing"],
    assumptions: ["Users have a workspace account"],
    dependencies: ["Identity provider"],
  },
  brd: { title: "Approval workflow", summary: "A workflow for reviewing and approving requests." },
  confidence: "medium",
  confidence_reason: "The transcript describes the approval path but not the escalation policy.",
};

class MockProvider implements ModelProvider {
  readonly provider = "mock";
  readonly model = "mock-discovery";
  private calls = 0;

  constructor(private readonly responses: string[]) {}

  async generate(_input: ModelInput): Promise<ModelOutput> {
    const text = this.responses[this.calls] ?? this.responses[this.responses.length - 1];
    this.calls += 1;
    return { text, stopReason: "stop", model: this.model, metadata: { provider: this.provider } };
  }
}

const transcript = "The team reviews each request, approves it, and escalates unclear ownership.";
const success = await extractDiscovery(
  transcript,
  new MockProvider([` \`\`\`json\n${JSON.stringify(validExtraction)}\n\`\`\` `]),
);
if (success.brd.title !== "Approval workflow") {
  throw new Error("AI discovery smoke failed to parse a fenced JSON response.");
}

const retried = await extractDiscovery(transcript, new MockProvider(["not-json", JSON.stringify(validExtraction)]));
if (retried.requirements.length !== 1) {
  throw new Error("AI discovery smoke failed to retry after invalid JSON.");
}

try {
  await extractDiscovery(transcript, new MockProvider(["not-json", "still-not-json"]));
  throw new Error("AI discovery smoke expected extraction failure.");
} catch (error) {
  if (!(error instanceof AiExtractionError)) throw error;
}

console.log("AI discovery smoke check passed");
