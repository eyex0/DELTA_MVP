import { writeFile } from "node:fs/promises";
import { BenchmarkManifest, BenchmarkSplit } from "./runner.js";
import { ProcessGraph } from "../domain/process.js";

const domains = [
  ["banking", "A retail bank"],
  ["insurance", "An insurance carrier"],
  ["healthcare", "A hospital network"],
  ["manufacturing", "A manufacturing plant"],
  ["logistics", "A logistics provider"],
  ["telecom", "A telecom operator"],
  ["retail", "A retail business"],
  ["energy", "An energy utility"],
  ["public_sector", "A public-service department"],
  ["software", "A software company"],
] as const;

const scenarios = [
  ["claim intake", "customer", "claims team", "The claimant submits evidence"],
  ["service request", "customer", "service desk", "The requester provides missing details"],
  ["purchase order", "buyer", "procurement team", "The supplier confirms availability"],
  ["incident response", "operator", "operations team", "The operator retries the failed action"],
  ["access request", "employee", "security team", "The requester resubmits corrected information"],
] as const;

function graph(id: string, domain: string, organization: string, subject: string, owner: string, exceptionText: string): ProcessGraph {
  const actorCustomer = { id: "ACTOR-REQUESTER", name: subject, type: "external_party" as const };
  const actorOwner = { id: "ACTOR-OWNER", name: owner, type: "team" as const };
  const actorSystem = { id: "ACTOR-SYSTEM", name: `${organization} workflow system`, type: "system" as const };
  const nodes = [
    { id: "N-START", type: "start" as const, name: "Process starts", inputs: [], outputs: [], conditions: [] },
    { id: "N-001", type: "activity" as const, name: `Receive ${subject} ${domain} request`, actorId: actorCustomer.id, inputs: ["request"], outputs: ["case"], conditions: [] },
    { id: "N-002", type: "automated_task" as const, name: "Register and validate the request", actorId: actorSystem.id, inputs: ["case"], outputs: ["validated case"], conditions: [] },
    { id: "N-003", type: "decision" as const, name: "Is the request complete and eligible?", actorId: actorOwner.id, inputs: [], outputs: [], conditions: ["complete", "eligible"] },
    { id: "N-004", type: "manual_task" as const, name: "Request missing information", actorId: actorOwner.id, inputs: ["missing fields"], outputs: ["clarification request"], conditions: [] },
    { id: "N-005", type: "wait" as const, name: "Wait for corrected information", actorId: actorCustomer.id, inputs: ["clarification request"], outputs: ["corrected information"], conditions: [] },
    { id: "N-006", type: "parallel_gateway" as const, name: "Start parallel review", inputs: [], outputs: [], conditions: [] },
    { id: "N-007", type: "activity" as const, name: "Perform business review", actorId: actorOwner.id, inputs: ["validated case"], outputs: ["review result"], conditions: [] },
    { id: "N-008", type: "automated_task" as const, name: "Run system verification", actorId: actorSystem.id, inputs: ["validated case"], outputs: ["verification result"], conditions: [] },
    { id: "N-009", type: "merge_gateway" as const, name: "Join parallel review", inputs: [], outputs: [], conditions: [] },
    { id: "N-010", type: "decision" as const, name: "Did both reviews approve the case?", actorId: actorOwner.id, inputs: ["review result", "verification result"], outputs: [], conditions: ["approved", "rejected"] },
    { id: "N-011", type: "exception" as const, name: exceptionText, actorId: actorOwner.id, inputs: ["rejected case"], outputs: ["exception record"], conditions: [] },
    { id: "N-012", type: "notification" as const, name: "Notify requester of the outcome", actorId: actorOwner.id, inputs: ["outcome"], outputs: ["notification"], conditions: [] },
    { id: "N-END", type: "end" as const, name: "Process ends", inputs: [], outputs: [], conditions: [] },
  ];
  const transitions = [
    ["T-001", "N-START", "N-001", "sequence"], ["T-002", "N-001", "N-002", "sequence"], ["T-003", "N-002", "N-003", "sequence"],
    ["T-004", "N-003", "N-004", "conditional", "incomplete"], ["T-005", "N-004", "N-005", "sequence"], ["T-006", "N-005", "N-002", "loop", "resubmit"],
    ["T-007", "N-003", "N-006", "conditional", "eligible"], ["T-008", "N-006", "N-007", "parallel"], ["T-009", "N-006", "N-008", "parallel"],
    ["T-010", "N-007", "N-009", "parallel"], ["T-011", "N-008", "N-009", "parallel"], ["T-012", "N-009", "N-010", "sequence"],
    ["T-013", "N-010", "N-011", "conditional", "rejected"], ["T-014", "N-010", "N-012", "conditional", "approved"],
    ["T-015", "N-011", "N-012", "exception"], ["T-016", "N-012", "N-END", "sequence"],
  ].map((entry) => {
    const [id, from, to, type, label] = entry;
    return { id: id!, from: from!, to: to!, type: type as ProcessGraph["transitions"][number]["type"], ...(label ? { label } : {}) };
  });
  return {
    schemaVersion: "1.0", processId: id, title: `${organization} ${domain} ${subject} workflow`, actors: [actorCustomer, actorOwner, actorSystem],
    nodes, transitions, decisions: [
      { id: "DECISION-001", nodeId: "N-003", question: "Is the case eligible for processing?", options: ["eligible", "ineligible"] },
      { id: "DECISION-002", nodeId: "N-010", question: "Was the review approved?", options: ["approved", "rejected"] },
    ], evidence: [
      { id: "E-001", source: "benchmark-input", quote: `The ${subject} process begins with a request and requires review evidence.`, confidence: 0.9 },
    ], businessRules: [
      { id: "RULE-001", description: "Incomplete cases must return for clarification", condition: "complete = false", truePath: "N-006", falsePath: "N-004" },
      { id: "RULE-002", description: "Rejected reviews create an exception record", condition: "approved = false", truePath: "N-012", falsePath: "N-011" },
    ],
    exceptions: [{ id: "EX-001", name: exceptionText, description: `The ${domain} workflow cannot proceed when the review rejects the case.`, handling: "Record the exception and notify the requester.", nodeId: "N-011" }],
    loops: [{ id: "LOOP-001", entryNodeId: "N-005", backNodeId: "N-002", description: "Requester corrects missing information and the case is revalidated.", condition: "information_complete = false" }],
    metadata: { domain, source: "DELTA benchmark v2", model: "human-authored-template", createdAt: "2026-09-20T00:00:00.000Z", tags: ["benchmark-v2", domain] },
  };
}

export function buildBenchmarkManifest(): BenchmarkManifest {
  const cases: BenchmarkManifest["cases"] = [];
  for (let index = 0; index < 100; index++) {
    const [domain, organization] = domains[index % domains.length]!;
    const [subject, requester, owner, exceptionText] = scenarios[Math.floor(index / domains.length) % scenarios.length]!;
    const id = `B2-${String(index + 1).padStart(3, "0")}`;
    const split: BenchmarkSplit = index < 60 ? "train" : index < 80 ? "validation" : index < 95 ? "test" : "challenge";
    const difficulty = index % 4 === 0 ? "simple" : index % 4 === 1 ? "intermediate" : index % 4 === 2 ? "complex" : "enterprise";
    const gold = graph(id, domain, organization, requester, owner, exceptionText);
    cases.push({
      id, domain, difficulty, split,
      input: `${organization} receives a ${subject}. ${requester} submits the initial information. The ${owner} registers and validates the case. If the case is incomplete, the team requests missing information and waits for a corrected resubmission before validating again. If it is eligible, business review and system verification happen in parallel. If both approve, the ${owner} notifies the requester. If either rejects, the team records an exception, then notifies the requester.`,
      gold,
      expectedRelationships: gold.transitions.map((transition) => ({ from: transition.from, to: transition.to, type: transition.type, ...(transition.label ? { label: transition.label } : {}) })),
      annotations: {
        ambiguity: ["The source does not specify an SLA for requester resubmission.", "The source does not define the exact rejection reason taxonomy."],
        assumptions: ["A single workflow system registers the case.", "Parallel branches must both complete before the final decision."],
        qualityStatus: "reviewed",
        reviewer: "DELTA-QC-TEAM",
      },
    });
  }
  return { version: "2.0.0", cases };
}

if (process.argv.includes("--write")) {
  const output = process.argv[process.argv.indexOf("--write") + 1] ?? "fixtures/benchmark-v2.json";
  await writeFile(output, JSON.stringify(buildBenchmarkManifest(), null, 2), "utf8");
}
