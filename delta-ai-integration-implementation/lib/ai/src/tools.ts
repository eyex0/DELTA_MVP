import { z } from "zod/v4";
import type { AgentTool, AgentToolContext, AgentRole } from "./agent.js";

export function createTool<TInput, TOutput>(
  definition: Omit<AgentTool<TInput, TOutput>, "roles"> & { roles?: AgentRole[] },
): AgentTool<TInput, TOutput> {
  return { ...definition, roles: definition.roles ?? (["delivery_lead", "admin"] satisfies AgentRole[]) };
}

export const projectIdInput = z.object({ projectId: z.string().min(1) });
export type ProjectIdInput = z.infer<typeof projectIdInput>;
export type ProjectSummary = { id: string; name: string; objective: string | null; status: string };

export function createProjectReadTool(
  read: (projectId: string, context: AgentToolContext) => Promise<ProjectSummary>,
): AgentTool<ProjectIdInput, ProjectSummary> {
  return createTool({
    name: "get_project",
    description: "Retrieve a project the authenticated user can access.",
    risk: "read",
    input: projectIdInput,
    output: z.object({ id: z.string(), name: z.string(), objective: z.string().nullable(), status: z.string() }),
    execute: (input, context) => read(input.projectId, context),
  });
}

export const createTaskInput = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(500),
  assignToMe: z.boolean().default(true),
});

export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type CreatedTask = { id: string; projectId: string; title: string; assignedTo: string; status: string };

export function createTaskTool(
  create: (input: CreateTaskInput, context: AgentToolContext) => Promise<CreatedTask>,
): AgentTool<CreateTaskInput, CreatedTask> {
  return createTool({
    name: "create_task",
    description: "Create a task in an accessible project and assign it to the current user.",
    risk: "write",
    roles: ["delivery_lead", "admin"],
    input: createTaskInput,
    output: z.object({ id: z.string(), projectId: z.string(), title: z.string(), assignedTo: z.string(), status: z.string() }),
    execute: (input, context) => create(input, context),
  });
}

export const listTasksInput = z.object({
  projectId: z.string().min(1).optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
});
export type ListTasksInput = z.infer<typeof listTasksInput>;
export type TaskRecord = { id: string; projectId: string; title: string; assignedTo: string; status: string };

export function createListTasksTool(
  list: (input: ListTasksInput, context: AgentToolContext) => Promise<TaskRecord[]>,
): AgentTool<ListTasksInput, TaskRecord[]> {
  return createTool({
    name: "list_tasks",
    description: "List real tasks assigned to the current user, optionally filtered by project or status.",
    risk: "read",
    input: listTasksInput,
    output: z.array(z.object({ id: z.string(), projectId: z.string(), title: z.string(), assignedTo: z.string(), status: z.string() })),
    execute: (input, context) => list(input, context),
  });
}

export const updateTaskInput = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(1).max(500).optional(),
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
}).refine((value) => value.title !== undefined || value.status !== undefined, "At least one task field is required");
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;

export function createUpdateTaskTool(
  update: (input: UpdateTaskInput, context: AgentToolContext) => Promise<TaskRecord>,
): AgentTool<UpdateTaskInput, TaskRecord> {
  return createTool({
    name: "update_task",
    description: "Update a task owned by the current user and return its persisted state.",
    risk: "write",
    roles: ["delivery_lead", "admin"],
    input: updateTaskInput,
    output: z.object({ id: z.string(), projectId: z.string(), title: z.string(), assignedTo: z.string(), status: z.string() }),
    execute: (input, context) => update(input, context),
  });
}

export function createVerifyTaskTool(
  read: (taskId: string, context: AgentToolContext) => Promise<TaskRecord>,
): AgentTool<{ taskId: string }, TaskRecord> {
  return createTool({
    name: "verify_task",
    description: "Read a task from the database to verify its current persisted state.",
    risk: "read",
    input: z.object({ taskId: z.string().min(1) }),
    output: z.object({ id: z.string(), projectId: z.string(), title: z.string(), assignedTo: z.string(), status: z.string() }),
    execute: (input, context) => read(input.taskId, context),
  });
}

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
};

export const searchKnowledgeInput = z.object({
  query: z.string().trim().min(2).max(2_000),
  projectId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

export function createSearchKnowledgeTool(
  search: (input: z.infer<typeof searchKnowledgeInput>, context: AgentToolContext) => Promise<KnowledgeSearchResult[]>,
): AgentTool<z.infer<typeof searchKnowledgeInput>, KnowledgeSearchResult[]> {
  return createTool({
    name: "search_knowledge",
    description: "Search persisted project knowledge and return source-backed document chunks. Use this before answering questions that depend on workspace context.",
    risk: "read",
    input: searchKnowledgeInput,
    output: z.array(z.object({
      chunkId: z.string(),
      documentId: z.string(),
      title: z.string(),
      content: z.string(),
      source: z.string(),
      score: z.number(),
    })),
    execute: (input, context) => search(input, context),
  });
}
