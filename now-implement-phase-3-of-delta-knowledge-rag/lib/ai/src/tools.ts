import { z } from "zod/v4";

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
};

export const searchKnowledgeInput = z.object({
  query: z.string().trim().min(2).max(2000),
  projectId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeInput>;

export function createSearchKnowledgeTool(
  search: (input: SearchKnowledgeInput, context: { organizationId: string; projectId?: string; userId?: string }) => Promise<KnowledgeSearchResult[]>,
) {
  return {
    name: "search_knowledge",
    description: "Search tenant-scoped project knowledge and return source-backed document chunks. Use before answering questions that depend on DELTA policy, product, or workspace knowledge.",
    risk: "read" as const,
    input: searchKnowledgeInput,
    output: z.array(z.object({
      chunkId: z.string(),
      documentId: z.string(),
      title: z.string(),
      content: z.string(),
      source: z.string(),
      score: z.number(),
    })),
    execute: async (input: SearchKnowledgeInput, context: { organizationId: string; projectId?: string; userId?: string }) => {
      if (context.projectId && input.projectId && input.projectId !== context.projectId) {
        throw new Error("Knowledge search cannot cross the active workspace boundary.");
      }
      return search(
        { ...input, projectId: context.projectId ?? input.projectId },
        context,
      );
    },
  };
}
