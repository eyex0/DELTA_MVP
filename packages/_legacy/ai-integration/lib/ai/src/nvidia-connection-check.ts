import { NvidiaProvider } from "./providers/nvidia-provider.js";

const required = ["NVIDIA_API_KEY", "NVIDIA_BASE_URL", "NVIDIA_MODEL"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`NVIDIA connection check requires: ${missing.join(", ")}`);
  process.exit(2);
}

const provider = new NvidiaProvider();
const result = await provider.generate({
  system: "Reply with exactly one short sentence.",
  prompt: "Say that the DELTA NVIDIA provider connection is working.",
  maxTokens: 32,
  temperature: 0,
});

if (!result.text.trim() || result.metadata?.provider !== "nvidia-nim") {
  throw new Error("NVIDIA returned an invalid normalized response");
}
console.log(JSON.stringify({
  provider: result.metadata.provider,
  model: result.model,
  requestId: result.metadata.requestId,
  latencyMs: result.metadata.latencyMs,
  response: result.text,
  usage: result.usage,
}));
