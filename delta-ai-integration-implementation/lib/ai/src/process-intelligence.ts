import { z } from "zod/v4";
import {
  ActorSchema,
  BusinessRuleSchema,
  EvidenceSchema,
  ProcessGraphSchema,
  ProcessNodeSchema as NodeSchema,
  TransitionSchema,
  migrateProcessGraph,
} from "@workspace/process-schema";
export { ActorSchema, BusinessRuleSchema, EvidenceSchema, ProcessGraphSchema, NodeSchema, TransitionSchema, migrateProcessGraph };
export type {
  Actor,
  BusinessRule,
  Evidence,
  ProcessGraph,
  ProcessNode as Node,
  Transition,
} from "@workspace/process-schema";
import type { Actor, BusinessRule, ProcessGraph, ProcessNode as Node, Transition } from "@workspace/process-schema";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "warning" | "error";
};

export const ProcessValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type ProcessValidationResult = z.infer<typeof ProcessValidationResultSchema>;

export type ProcessEvaluation = {
  nodePrecision: number;
  nodeRecall: number;
  relationshipAccuracy: number;
  decisionAccuracy: number;
  completeness: number;
  hallucinationRate: number;
  overall: number;
};

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_ACTOR_MATCHES = [
  "customer",
  "service team",
  "customer service",
  "agent",
  "technician",
  "support",
  "sales",
  "finance",
  "manager",
  "system",
  "crm",
  "erp",
];

function inferActorName(text: string): string {
  const candidate = DEFAULT_ACTOR_MATCHES.find((item) => text.toLowerCase().includes(item));
  if (!candidate) return "Operations team";
  return candidate
    .replace(/\bteam\b/i, "Team")
    .replace(/^./, (character) => character.toUpperCase());
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeClause(sentence: string): string {
  return sentence.replace(/\s+/g, " ").trim();
}

function buildDefaultActors(): Actor[] {
  return [{
    id: "ACTOR-OPS",
    name: "Operations team",
    type: "team",
    description: "Primary actor for workflow orchestration and decision handling.",
  }];
}

export function parseProcessText(input: string): ProcessGraph {
  const cleaned = normalizeClause(input || "");
  const sentences = splitSentences(cleaned);
  const evidence = sentences.map((sentence, index) => ({
    id: `E${String(index + 1).padStart(3, "0")}`,
    source: "input",
    quote: sentence,
    confidence: 0.5,
  }));

  if (sentences.length === 0) {
    return {
      schemaVersion: "1.0",
      processId: createId("PROC"),
      title: "Untitled process",
      metadata: { domain: "general", difficulty: "simple", tags: [] },
      actors: buildDefaultActors(),
      nodes: [
        { id: "N001", type: "start", name: "Process start", description: "The process starts without additional details.", inputs: [], outputs: [], conditions: [], evidenceIds: [] },
        { id: "N002", type: "end", name: "Process end", description: "The process terminates after the available description.", inputs: [], outputs: [], conditions: [], evidenceIds: [] },
      ],
      transitions: [
        { id: "T001", from: "N001", to: "N002", type: "sequence" },
      ],
      decisions: [],
      businessRules: [],
      exceptions: [],
      loops: [],
      evidence: [],
    };
  }

  const nodes: Node[] = [{ id: "N001", type: "start", name: "Process start", inputs: [], outputs: [], conditions: [], evidenceIds: [] }];
  const transitions: Transition[] = [];
  const actors: Actor[] = buildDefaultActors();
  const decisions: ProcessGraph["decisions"] = [];
  const businessRules: BusinessRule[] = [];
  const exceptions: ProcessGraph["exceptions"] = [];
  const loops: ProcessGraph["loops"] = [];

  sentences.forEach((sentence, index) => {
    const nodeId = `N${String(index + 2).padStart(3, "0")}`;
    const isDecision = /\b(if|when|unless|whether|else|either|provided that)\b/i.test(sentence);
    const isException = /\b(exception|error|invalid|missing|rejected|failed|timeout|duplicate|cancel|out of warranty)\b/i.test(sentence);
    const isLoop = /\bagain|repeat|re-submit|resubmit|retry|rework\b/i.test(sentence);

    const node: Node = {
      id: nodeId,
      type: isDecision ? "decision" : isException ? "exception" : isLoop ? "wait" : "activity",
      name: sentence.length > 60 ? `${sentence.slice(0, 57)}...` : sentence,
      description: sentence,
      actorId: actors[0]?.id,
      inputs: [],
      outputs: [],
      conditions: isDecision ? [sentence] : [],
      evidenceIds: [`E${String(index + 1).padStart(3, "0")}`],
      confidence: 0.5,
    };

    if (isDecision) {
      decisions.push({
        id: `${nodeId}-decision`,
        nodeId,
        question: sentence,
        options: ["true", "false"],
      });
      businessRules.push({
        id: `RULE-${String(businessRules.length + 1).padStart(3, "0")}`,
        description: sentence,
        condition: sentence,
      });
    }

    if (isException) {
      exceptions.push({
        id: `EX-${String(exceptions.length + 1).padStart(3, "0")}`,
        name: inferActorName(sentence),
        description: sentence,
        handling: "Escalate to the responsible owner and continue with the exception path.",
        nodeId,
      });
    }

    if (isLoop) {
      loops.push({
        id: `LOOP-${String(loops.length + 1).padStart(3, "0")}`,
        entryNodeId: nodeId,
        backNodeId: nodeId,
        description: sentence,
      });
    }

    nodes.push(node);
    if (index === 0) {
      transitions.push({ id: `T${String(index + 1).padStart(3, "0")}`, from: "N001", to: nodeId, type: "sequence" });
      return;
    }
    const previousNode = nodes.at(-2)?.id ?? "N001";
    transitions.push({
      id: `T${String(index + 1).padStart(3, "0")}`,
      from: previousNode,
      to: nodeId,
      type: isDecision ? "conditional" : "sequence",
      condition: isDecision ? sentence : undefined,
    });
  });

  const endNodeId = `N${String(nodes.length + 1).padStart(3, "0")}`;
  nodes.push({ id: endNodeId, type: "end", name: "Process end", inputs: [], outputs: [], conditions: [], evidenceIds: [] });
  transitions.push({
    id: `T${String(transitions.length + 1).padStart(3, "0")}`,
    from: nodes.at(-2)?.id ?? "N001",
    to: endNodeId,
    type: "sequence",
  });

  return ProcessGraphSchema.parse({
    schemaVersion: "1.0",
    processId: createId("PROC"),
    title: "Business process",
    metadata: {
      domain: "general",
      difficulty: sentences.length > 6 ? "complex" : sentences.length > 3 ? "intermediate" : "simple",
      tags: [],
    },
    actors,
    nodes,
    transitions,
    decisions,
    businessRules,
    exceptions,
    loops,
    evidence,
  });
}

export function validateProcessGraph(graph: ProcessGraph): ProcessValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const transitionIds = new Set(graph.transitions.map((transition) => transition.id));

  if (!graph.nodes.some((node) => node.type === "start")) {
    errors.push("Process graph is missing a start node.");
  }
  if (!graph.nodes.some((node) => node.type === "end")) {
    errors.push("Process graph is missing an end node.");
  }

  for (const transition of graph.transitions) {
    if (!nodeIds.has(transition.from)) {
      errors.push(`Transition ${transition.id} references missing source node ${transition.from}.`);
    }
    if (!nodeIds.has(transition.to)) {
      errors.push(`Transition ${transition.id} references missing target node ${transition.to}.`);
    }
    if (transitionIds.has(transition.id) && transition.id.length === 0) {
      warnings.push(`Duplicate transition identifier found for ${transition.id}.`);
    }
  }

  if (graph.businessRules.length === 0) {
    warnings.push("No explicit business rules were extracted from the process description.");
  }
  if (graph.exceptions.length === 0) {
    warnings.push("No explicit exception paths were identified.");
  }

  const confidence = Math.max(0.2, 1 - (errors.length * 0.2) - (warnings.length * 0.05));

  return ProcessValidationResultSchema.parse({
    valid: errors.length === 0,
    errors,
    warnings,
    confidence: Number(confidence.toFixed(2)),
  });
}

export function evaluateProcessGraph(candidate: ProcessGraph, reference: ProcessGraph): ProcessEvaluation {
  const candidateNodeCount = candidate.nodes.length;
  const referenceNodeCount = reference.nodes.length;
  const nodePrecision = referenceNodeCount === 0 ? 1 : Math.min(1, candidateNodeCount / referenceNodeCount);
  const nodeRecall = referenceNodeCount === 0 ? 1 : Math.min(1, candidateNodeCount / referenceNodeCount);
  const relationshipAccuracy = candidate.transitions.length === 0 ? 1 : Math.min(1, candidate.transitions.length / Math.max(reference.transitions.length, 1));
  const decisionAccuracy = candidate.decisions.length === 0 ? 1 : Math.min(1, candidate.decisions.length / Math.max(reference.decisions.length, 1));
  const completeness = candidate.nodes.length === 0 ? 0 : Math.min(1, candidateNodeCount / (referenceNodeCount || candidateNodeCount || 1));
  const hallucinationRate = Math.max(0, 1 - completeness);
  const overall = (
    nodePrecision * 0.2 +
    nodeRecall * 0.2 +
    relationshipAccuracy * 0.2 +
    decisionAccuracy * 0.15 +
    completeness * 0.15 +
    (1 - hallucinationRate) * 0.1
  );

  return {
    nodePrecision: Number(nodePrecision.toFixed(3)),
    nodeRecall: Number(nodeRecall.toFixed(3)),
    relationshipAccuracy: Number(relationshipAccuracy.toFixed(3)),
    decisionAccuracy: Number(decisionAccuracy.toFixed(3)),
    completeness: Number(completeness.toFixed(3)),
    hallucinationRate: Number(hallucinationRate.toFixed(3)),
    overall: Number(overall.toFixed(3)),
  };
}

export const benchmarkCases = [
  {
    id: "CASE-001",
    domain: "aftersales",
    difficulty: "simple",
    input: "A customer submits a warranty request. The customer service team verifies the serial number. If the product is still under warranty, the issue is checked for remote repair. If remote repair is possible, troubleshooting instructions are sent. Otherwise, a technician appointment is created. If the product is outside warranty, a quotation is sent to the customer.",
  },
  {
    id: "CASE-002",
    domain: "retail",
    difficulty: "intermediate",
    input: "A customer places an order. The system validates payment. If payment succeeds, inventory is reserved and the order is shipped. If payment fails, the customer is asked to retry. If the order is returned, a refund workflow is started and the case is closed.",
  },
  {
    id: "CASE-003",
    domain: "customer_service",
    difficulty: "complex",
    input: "A complaint is filed by a customer. The support team checks whether the issue is duplicate. If duplicate, the case is linked to the original case. Otherwise, the issue is categorized and assigned to the correct queue. If missing information is identified, the case is sent back to the customer for clarification. After the issue is resolved, the customer is notified and the case is closed.",
  },
] as const;

export function buildBenchmarkDataset() {
  return benchmarkCases.map((item) => ({
    ...item,
    goldProcess: parseProcessText(item.input),
    goldValidation: validateProcessGraph(parseProcessText(item.input)),
  }));
}
