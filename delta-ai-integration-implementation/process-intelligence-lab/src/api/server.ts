import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { DeterministicBaselineAdapter } from "../adapters/model.js";
import { compileBpmn, compileMermaid, compileReactFlow } from "../compiler/editable.js";
import { decodeProcessGraph } from "../adapters/model.js";
import { validateBpmnConformance } from "../validation/bpmn.js";
import { validateProcessGraph } from "../validation/validator.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function body(req: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of req) text += new TextDecoder().decode(chunk);
  return JSON.parse(text || "{}");
}

export function createApiServer() {
  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") return json(res, 200, { status: "ok", service: "delta-process-intelligence-lab" });
      if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
      const input = await body(req);
      if (req.url === "/process/parse") {
        const text = (input as { text?: unknown }).text;
        if (typeof text !== "string" || !text.trim()) return json(res, 400, { error: "text is required" });
        const process = (await new DeterministicBaselineAdapter().generate({ input: text, schemaVersion: "1.0" })).graph;
        return json(res, 200, { process, validation: validateProcessGraph(process), bpmn: validateBpmnConformance(process) });
      }
      if (req.url === "/process/validate") {
        const process = decodeProcessGraph((input as { process?: unknown }).process);
        return json(res, 200, { validation: validateProcessGraph(process), bpmn: validateBpmnConformance(process) });
      }
      if (req.url === "/process/render") {
        const process = decodeProcessGraph((input as { process?: unknown }).process);
        const format = (input as { format?: string }).format ?? "react-flow";
        const diagram = format === "bpmn" ? compileBpmn(process) : format === "mermaid" ? compileMermaid(process) : compileReactFlow(process);
        return json(res, 200, diagram);
      }
      return json(res, 404, { error: "Route not found" });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : "Request failed" });
    }
  });
}
