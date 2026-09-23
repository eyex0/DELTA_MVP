import { z } from "zod/v4";
import { AgentToolRegistry, runAgent } from "./agent.js";
import { createTool } from "./tools.js";

const calls: string[] = [];
const registry = new AgentToolRegistry().register(createTool({
  name: "record",
  description: "Record a value",
  risk: "write",
  input: z.object({ value: z.string() }),
  output: z.object({ id: z.string() }),
  execute: async (input) => {
    calls.push(input.value);
    return { id: "real-1" };
  },
}));

let turn = 0;
const result = await runAgent({
  provider: {
    generate: async () => ({
      stopReason: "stop",
      text: turn++ === 0
        ? JSON.stringify({ type: "tool_call", tool: "record", input: { value: "ok" } })
        : JSON.stringify({ type: "final", response: "Recorded real-1" }),
    }),
  },
  registry,
  context: { userId: "user-1", organizationId: "org-1", workspaceId: "workspace-1", role: "delivery_lead" },
  request: "Record ok",
});

if (result.status !== "completed" || calls[0] !== "ok") {
  throw new Error(`Agent execution check failed: ${JSON.stringify(result)}`);
}
console.log("agent-check passed", JSON.stringify(result));
