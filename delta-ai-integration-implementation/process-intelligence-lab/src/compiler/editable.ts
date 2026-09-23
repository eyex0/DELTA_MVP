import { ProcessGraph } from "../domain/process.js";

export interface EditableNode { id: string; type: string; position: { x: number; y: number }; data: { label: string; actorId?: string }; }
export interface EditableEdge { id: string; source: string; target: string; label?: string; type: string; }
export interface EditableDiagram { format: "react-flow" | "mermaid" | "bpmn"; nodes: EditableNode[]; edges: EditableEdge[]; source?: string; }

export function compileReactFlow(graph: ProcessGraph): EditableDiagram {
  const levels = new Map<string, number>([["N-START", 0]]);
  for (let pass = 0; pass < graph.nodes.length; pass++) for (const edge of graph.transitions) {
    const sourceLevel = levels.get(edge.from);
    if (sourceLevel !== undefined) levels.set(edge.to, Math.max(levels.get(edge.to) ?? 0, sourceLevel + 1));
  }
  const columns = new Map<number, number>();
  const nodes = graph.nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const row = columns.get(level) ?? 0;
    columns.set(level, row + 1);
    return { id: node.id, type: node.type, position: { x: level * 300, y: row * 160 }, data: { label: node.name, ...(node.actorId ? { actorId: node.actorId } : {}) } };
  });
  const edges = graph.transitions.map((edge) => ({ id: edge.id, source: edge.from, target: edge.to, type: edge.type, ...(edge.label || edge.condition ? { label: edge.label ?? edge.condition } : {}) }));
  return { format: "react-flow", nodes, edges };
}

export function compileBpmn(graph: ProcessGraph): EditableDiagram {
  const events = graph.nodes.filter((node) => node.type === "start" || node.type === "end").map((node) => `<bpmn:task id="${node.id}" name="${node.name.replace(/"/g, "&quot;")}" />`);
  const tasks = graph.nodes.filter((node) => !["start", "end"].includes(node.type)).map((node) => `<bpmn:task id="${node.id}" name="${node.name.replace(/"/g, "&quot;")}" />`);
  const flows = graph.transitions.map((edge) => `<bpmn:sequenceFlow id="${edge.id}" sourceRef="${edge.from}" targetRef="${edge.to}"${edge.condition ? ` name="${edge.condition.replace(/"/g, "&quot;")}"` : ""} />`);
  return { format: "bpmn", nodes: [], edges: [], source: `<bpmn:definitions id="${graph.processId}" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="${graph.processId}" isExecutable="false">${[...events, ...tasks, ...flows].join("")}</bpmn:process></bpmn:definitions>` };
}

export function compileMermaid(graph: ProcessGraph): EditableDiagram {
  const lines = ["flowchart TD"];
  for (const node of graph.nodes) lines.push(`  ${node.id.replace(/-/g, "_")}["${node.name.replace(/"/g, "'")}"]`);
  for (const edge of graph.transitions) lines.push(`  ${edge.from.replace(/-/g, "_")} -->${edge.label || edge.condition ? `|${(edge.label ?? edge.condition)!.replace(/\|/g, "/")}|` : ""} ${edge.to.replace(/-/g, "_")}`);
  return { format: "mermaid", nodes: [], edges: [], source: lines.join("\n") };
}
