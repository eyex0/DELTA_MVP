import assert from "node:assert/strict";
import { z } from "zod/v4";
import { AgentToolRegistry, runAgent } from "./agent.js";
import { createTool } from "./tools.js";

const context = { userId: "u", organizationId: "o", workspaceId: "workspace-1", role: "delivery_lead" as const };
let executions = 0;
const registry = new AgentToolRegistry().register(createTool({
  name: "write_record",
  description: "Write one record",
  risk: "write",
  input: z.object({ title: z.string().min(3) }),
  output: z.object({ id: z.string(), title: z.string() }),
  execute: async (input) => {
    executions += 1;
    return { id: "task-1", title: input.title };
  },
}));

let turn = 0;
const result = await runAgent({
  provider: {
    generate: async () => ({
      text: turn++ === 0
        ? JSON.stringify({ type: "tool_call", tool: "write_record", input: { title: "DELTA task" } })
        : JSON.stringify({ type: "final", response: "Created task-1" }),
      stopReason: "stop",
      usage: { totalTokens: 10 },
    }),
  },
  registry,
  context,
  request: "Create a task",
});
assert.equal(result.status, "completed");
assert.equal(executions, 1);
assert.equal(result.usage?.totalTokens, 20);

let nativeTurn = 0;
const nativeResult = await runAgent({
  provider: {
    generate: async () => nativeTurn++ === 0
      ? {
          text: "",
          stopReason: "tool_calls",
          toolCalls: [
            { id: "call-1", name: "write_record", arguments: JSON.stringify({ title: "First task" }) },
            { id: "call-2", name: "write_record", arguments: JSON.stringify({ title: "Second task" }) },
          ],
        }
      : { text: JSON.stringify({ type: "final", response: "Created both tasks" }), stopReason: "stop" },
  },
  registry,
  context,
  request: "Create two tasks",
});
assert.equal(nativeResult.status, "completed");
assert.equal(executions, 3);

const denied = await runAgent({
  provider: { generate: async () => ({ text: JSON.stringify({ type: "tool_call", tool: "write_record", input: { title: "DELTA task" } }), stopReason: "stop" }) },
  registry,
  context: { ...context, role: "client_reviewer" },
  request: "Create a task",
  maxSteps: 1,
});
assert.equal(denied.status, "failed");

const timedOut = await runAgent({
  provider: { generate: async () => new Promise((resolve) => setTimeout(() => resolve({ text: '{"type":"final","response":"late"}', stopReason: "stop" }), 30)) },
  registry,
  context,
  request: "Wait",
  timeoutMs: 5,
});
assert.equal(timedOut.status, "failed");
assert.match(timedOut.reason ?? "", /timed out/i);

const missingContext = await runAgent({
  provider: { generate: async () => ({ text: '{"type":"final","response":"guessed"}', stopReason: "stop" }) },
  registry,
  context,
  request: "According to the internal policy, what is the warranty process?",
  contextAssembler: async () => undefined,
});
assert.equal(missingContext.status, "failed");
assert.match(missingContext.reason ?? "", /context/i);

console.log("agent-engine checks passed");
