import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "./index";
import { agentContextTable, knowledgeChunksTable, knowledgeDocumentsTable, knowledgeMemoriesTable } from "./schema";

export type KnowledgeEmbeddingProvider = {
  embed(text: string): Promise<number[]>;
};

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
};

export function chunkText(text: string, options: { maxCharacters?: number; overlapCharacters?: number } = {}): string[] {
  const max = Math.max(200, options.maxCharacters ?? 1_200);
  const overlap = Math.min(Math.max(0, options.overlapCharacters ?? 150), max - 1);
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + max);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      if (Math.max(boundary, sentence) > start + max * 0.55) end = Math.max(boundary, sentence) + 1;
    }
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

export async function ingestKnowledgeDocument(input: {
  organizationId: string;
  projectId?: string;
  title: string;
  source: string;
  sourceType?: string;
  content: string;
  embeddings?: KnowledgeEmbeddingProvider;
}): Promise<{ id: string; status: string; chunks: number }> {
  const [document] = await db.insert(knowledgeDocumentsTable).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    title: input.title,
    source: input.source,
    sourceType: input.sourceType ?? "text",
    content: input.content,
    status: "pending",
  }).returning({ id: knowledgeDocumentsTable.id });
  try {
    await db.update(knowledgeDocumentsTable).set({ status: "processing", updatedAt: new Date() }).where(eq(knowledgeDocumentsTable.id, document.id));
    const chunks = chunkText(input.content);
    for (let i = 0; i < chunks.length; i += 1) {
      const embedding = input.embeddings ? await input.embeddings.embed(chunks[i]) : null;
      await db.insert(knowledgeChunksTable).values({
        documentId: document.id,
        chunkIndex: i,
        content: chunks[i],
        tokenCount: chunks[i].split(/\s+/).length,
        embedding,
      });
    }
    await db.update(knowledgeDocumentsTable).set({ status: "ready", updatedAt: new Date(), error: null }).where(eq(knowledgeDocumentsTable.id, document.id));
    return { id: document.id, status: "ready", chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document ingestion failed";
    await db.update(knowledgeDocumentsTable).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(knowledgeDocumentsTable.id, document.id));
    throw error;
  }
}

export function createKnowledgeSearchProvider(options: { embeddings?: KnowledgeEmbeddingProvider } = {}) {
  return {
    async search(input: { organizationId: string; projectId?: string; query: string; limit: number }): Promise<KnowledgeSearchResult[]> {
      const scope = input.projectId
        ? and(eq(knowledgeDocumentsTable.organizationId, input.organizationId), eq(knowledgeDocumentsTable.projectId, input.projectId))
        : eq(knowledgeDocumentsTable.organizationId, input.organizationId);
      if (options.embeddings) {
        try {
          const embedding = await options.embeddings.embed(input.query);
          const distance = sql<number>`${knowledgeChunksTable.embedding} <=> ${`[${embedding.join(",")}]`}::vector`;
          const semantic = await db.select({
            chunkId: knowledgeChunksTable.id,
            documentId: knowledgeDocumentsTable.id,
            title: knowledgeDocumentsTable.title,
            content: knowledgeChunksTable.content,
            source: knowledgeDocumentsTable.source,
            score: sql<number>`1 - ${distance}`,
          }).from(knowledgeChunksTable)
            .innerJoin(knowledgeDocumentsTable, eq(knowledgeDocumentsTable.id, knowledgeChunksTable.documentId))
            .where(and(scope, eq(knowledgeDocumentsTable.status, "ready"), sql`${knowledgeChunksTable.embedding} is not null`))
            .orderBy(distance)
            .limit(input.limit);
          return semantic;
        } catch {
          // pgvector is optional; keyword search remains available without the extension.
        }
      }
      const terms = input.query.trim().split(/\s+/).filter(Boolean).slice(0, 8);
      if (!terms.length) return [];
      const matches = terms.map((term) => ilike(knowledgeChunksTable.content, `%${term}%`));
      return db.select({
        chunkId: knowledgeChunksTable.id,
        documentId: knowledgeDocumentsTable.id,
        title: knowledgeDocumentsTable.title,
        content: knowledgeChunksTable.content,
        source: knowledgeDocumentsTable.source,
        score: sql<number>`1.0`,
      }).from(knowledgeChunksTable)
        .innerJoin(knowledgeDocumentsTable, eq(knowledgeDocumentsTable.id, knowledgeChunksTable.documentId))
        .where(and(scope, eq(knowledgeDocumentsTable.status, "ready"), or(...matches)))
        .orderBy(desc(knowledgeChunksTable.createdAt))
        .limit(input.limit);
    },
  };
}

export async function saveKnowledgeMemory(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  kind?: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const [memory] = await db.insert(knowledgeMemoriesTable).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    kind: input.kind ?? "note",
    content: input.content,
    metadata: input.metadata ?? {},
  }).returning();
  return memory;
}

export async function retrieveKnowledgeMemories(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  query?: string;
  limit?: number;
}) {
  const scope = [
    eq(knowledgeMemoriesTable.organizationId, input.organizationId),
    input.projectId ? eq(knowledgeMemoriesTable.projectId, input.projectId) : sql`true`,
    input.userId
      ? or(eq(knowledgeMemoriesTable.userId, input.userId), sql`${knowledgeMemoriesTable.userId} is null`)
      : sql`true`,
  ];
  const rows = await db.select().from(knowledgeMemoriesTable)
    .where(and(...scope))
    .orderBy(desc(knowledgeMemoriesTable.createdAt))
    .limit(Math.min(input.limit ?? 5, 20));
  if (!input.query?.trim()) return rows;
  const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .map((row) => ({ row, score: terms.filter((term) => row.content.toLowerCase().includes(term)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ row }) => row);
}

export async function saveAgentContext(input: {
  organizationId: string;
  projectId?: string;
  requestHash: string;
  context: string;
  sources: string[];
  expiresAt?: Date;
}) {
  const [record] = await db.insert(agentContextTable).values(input).returning();
  return record;
}

export async function assembleKnowledgeContext(input: {
  organizationId: string;
  projectId?: string;
  query: string;
  limit?: number;
  embeddings?: KnowledgeEmbeddingProvider;
  userId?: string;
}) {
  const results = await createKnowledgeSearchProvider({ embeddings: input.embeddings }).search({
    organizationId: input.organizationId,
    projectId: input.projectId,
    query: input.query,
    limit: input.limit ?? 5,
  });
  const memories = await retrieveKnowledgeMemories({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    query: input.query,
    limit: 5,
  });
  return {
    text: [
      results.map((result) => `[SOURCE: ${result.title}] (${result.source})\n${result.content}`).join("\n\n"),
      memories.map((memory) => `[MEMORY: ${memory.kind}]\n${memory.content}`).join("\n\n"),
    ].filter(Boolean).join("\n\n"),
    sources: results.map((result) => result.source),
    results,
    memories,
  };
}
