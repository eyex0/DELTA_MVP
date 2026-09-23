import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, disabledDb } from "@workspace/db";
import {
  agentContextTable,
  knowledgeChunksTable,
  knowledgeDocumentsTable,
  knowledgeEmbeddingsTable,
  knowledgeMemoriesTable,
} from "@workspace/db";

export type KnowledgeEmbeddingProvider = {
  embed(text: string): Promise<number[]>;
  model?: string;
};

export function createOpenAIEmbeddingProvider(config: { apiKey?: string; model?: string; dimensions?: number; baseUrl?: string } = {}): KnowledgeEmbeddingProvider {
  const apiKey = config.apiKey ?? process.env.DELTA_EMBEDDING_API_KEY ?? process.env.EMBEDDING_API_KEY;
  const model = config.model ?? process.env.DELTA_EMBEDDING_MODEL ?? process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
  const baseUrl = (config.baseUrl ?? process.env.DELTA_EMBEDDING_BASE_URL ?? process.env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const dims = config.dimensions ?? Number(process.env.DELTA_EMBEDDING_DIMENSIONS ?? process.env.EMBEDDING_DIMENSIONS ?? 1536);

  if (!apiKey) {
    throw new Error("OpenAI embedding provider requires DELTA_EMBEDDING_API_KEY or EMBEDDING_API_KEY.");
  }

  return {
    model,
    async embed(text: string): Promise<number[]> {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          dimensions: Number.isFinite(dims) ? dims : undefined,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`OpenAI embedding request failed: ${response.status} ${bodyText}`);
      }

      const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      const vector = payload.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("OpenAI embedding response did not include a valid embedding array.");
      }
      return vector;
    },
  };
}

export function createAzureOpenAIEmbeddingProvider(config: { apiKey?: string; endpoint?: string; model?: string; dimensions?: number; apiVersion?: string } = {}): KnowledgeEmbeddingProvider {
  const apiKey = config.apiKey ?? process.env.AZURE_OPENAI_API_KEY ?? process.env.DELTA_AZURE_OPENAI_API_KEY;
  const endpoint = (config.endpoint ?? process.env.AZURE_OPENAI_ENDPOINT ?? process.env.DELTA_AZURE_OPENAI_ENDPOINT ?? "").replace(/\/$/, "");
  const model = config.model ?? process.env.AZURE_OPENAI_EMBEDDING_MODEL ?? process.env.DELTA_AZURE_OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const apiVersion = config.apiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? process.env.DELTA_AZURE_OPENAI_API_VERSION ?? "2024-02-01";
  const dims = config.dimensions ?? Number(process.env.DELTA_EMBEDDING_DIMENSIONS ?? process.env.EMBEDDING_DIMENSIONS ?? 1536);

  if (!apiKey || !endpoint) {
    throw new Error("Azure OpenAI embedding provider requires AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT.");
  }

  return {
    model,
    async embed(text: string): Promise<number[]> {
      const url = `${endpoint}/openai/deployments/${model}/embeddings?api-version=${apiVersion}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: text, dimensions: Number.isFinite(dims) ? dims : undefined }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Azure OpenAI embedding request failed: ${response.status} ${bodyText}`);
      }

      const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      const vector = payload.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Azure OpenAI embedding response did not include a valid embedding array.");
      }
      return vector;
    },
  };
}

const resolveEmbeddingProviderFromEnv = (dimensions = 128): KnowledgeEmbeddingProvider => {
  const configuredProvider = (process.env.DELTA_EMBEDDING_PROVIDER ?? process.env.EMBEDDING_PROVIDER ?? "deterministic").toLowerCase();
  const configuredDimensions = Number(process.env.DELTA_EMBEDDING_DIMENSIONS ?? process.env.EMBEDDING_DIMENSIONS ?? dimensions);

  if (configuredProvider === "openai") {
    return createOpenAIEmbeddingProvider({
      apiKey: process.env.DELTA_EMBEDDING_API_KEY ?? process.env.EMBEDDING_API_KEY,
      model: process.env.DELTA_EMBEDDING_MODEL ?? process.env.EMBEDDING_MODEL,
      dimensions: Number.isFinite(configuredDimensions) ? configuredDimensions : dimensions,
      baseUrl: process.env.DELTA_EMBEDDING_BASE_URL ?? process.env.EMBEDDING_BASE_URL,
    });
  }

  if (configuredProvider === "azure-openai" || configuredProvider === "azure") {
    return createAzureOpenAIEmbeddingProvider({
      apiKey: process.env.AZURE_OPENAI_API_KEY ?? process.env.DELTA_AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT ?? process.env.DELTA_AZURE_OPENAI_ENDPOINT,
      model: process.env.AZURE_OPENAI_EMBEDDING_MODEL ?? process.env.DELTA_AZURE_OPENAI_EMBEDDING_MODEL,
      dimensions: Number.isFinite(configuredDimensions) ? configuredDimensions : dimensions,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? process.env.DELTA_AZURE_OPENAI_API_VERSION,
    });
  }

  if (configuredProvider !== "deterministic") {
    const apiKey = process.env.DELTA_EMBEDDING_API_KEY ?? process.env.EMBEDDING_API_KEY;
    if (!apiKey) {
      throw new Error(`Embedding provider "${configuredProvider}" requires a configured API key.`);
    }
  }

  return createDefaultEmbeddingProvider(Number.isFinite(configuredDimensions) ? configuredDimensions : dimensions);
};

export function getConfiguredEmbeddingProvider(dimensions = 128): KnowledgeEmbeddingProvider {
  return resolveEmbeddingProviderFromEnv(dimensions);
}

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, unknown>;
};

const disabledStore = {
  documents: [] as Array<Record<string, unknown>>,
  chunks: [] as Array<Record<string, unknown>>,
  embeddings: [] as Array<Record<string, unknown>>,
  memories: [] as Array<Record<string, unknown>>,
  context: [] as Array<Record<string, unknown>>,
};

export function chunkText(text: string, options: { maxCharacters?: number; overlapCharacters?: number } = {}): string[] {
  const maxSize = Math.max(180, options.maxCharacters ?? 1_200);
  const overlap = Math.min(Math.max(0, options.overlapCharacters ?? 120), maxSize - 1);
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + maxSize);
    if (end < normalized.length) {
      const newline = normalized.lastIndexOf("\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const bestBoundary = Math.max(newline, sentence);
      if (bestBoundary > start + Math.floor(maxSize * 0.6)) {
        end = bestBoundary + 1;
      }
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks.filter(Boolean);
}

export function createDefaultEmbeddingProvider(dimensions = 128): KnowledgeEmbeddingProvider {
  return {
    model: "deterministic-local",
    async embed(text: string): Promise<number[]> {
      const seed = Array.from(text).reduce((acc, ch, index) => acc + ch.charCodeAt(0) * (index + 1), 0);
      const values = new Array(dimensions).fill(0);
      for (let i = 0; i < dimensions; i += 1) {
        values[i] = Math.sin((seed + i * 17.13) / 7.37);
      }
      return values;
    },
  };
}

function cosineSimilarity(left: number[], right: number[]): number {
  const minLength = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < minLength; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ingestKnowledgeDocument(input: {
  organizationId: string;
  projectId?: string;
  title: string;
  source: string;
  sourceType?: string;
  content: string;
  embeddings?: KnowledgeEmbeddingProvider;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; status: string; chunks: number; message?: string }> {
  const normalizedSourceType = input.sourceType ?? "text";
  const embedder = input.embeddings ?? getConfiguredEmbeddingProvider();
  if (disabledDb) {
    const documentId = makeId("doc");
    const chunks = chunkText(input.content);
    const createdAt = new Date();
    const document = {
      id: documentId,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      title: input.title,
      source: input.source,
      sourceType: normalizedSourceType,
      content: input.content,
      status: "ready",
      error: null,
      metadata: input.metadata ?? {},
      createdAt,
      updatedAt: createdAt,
    };
    disabledStore.documents.push(document);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkId = makeId("chunk");
      const embedding = await embedder.embed(chunks[index]);
      disabledStore.chunks.push({
        id: chunkId,
        documentId,
        chunkIndex: index,
        content: chunks[index],
        tokenCount: chunks[index].split(/\s+/).filter(Boolean).length,
        embedding,
        metadata: { sourceType: normalizedSourceType },
        createdAt,
      });
      disabledStore.embeddings.push({
        id: makeId("emb"),
        documentId,
        chunkId,
        model: embedder.model ?? "configured",
        dimensions: embedding.length,
        status: "ready",
        embedding,
        createdAt,
      });
    }
    return { id: documentId, status: "ready", chunks: chunks.length };
  }

  const [document] = await db.insert(knowledgeDocumentsTable).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    title: input.title,
    source: input.source,
    sourceType: normalizedSourceType,
    content: input.content,
    status: "processing",
    metadata: input.metadata ?? {},
  }).returning({ id: knowledgeDocumentsTable.id });

  try {
    const chunks = chunkText(input.content);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkTextValue = chunks[index];
      const [chunk] = await db.insert(knowledgeChunksTable).values({
        documentId: document.id,
        chunkIndex: index,
        content: chunkTextValue,
        tokenCount: chunkTextValue.split(/\s+/).filter(Boolean).length,
        metadata: { sourceType: normalizedSourceType },
      }).returning({ id: knowledgeChunksTable.id });
      const embedding = await embedder.embed(chunkTextValue);
      await db.insert(knowledgeEmbeddingsTable).values({
        documentId: document.id,
        chunkId: chunk.id,
        model: embedder.model ?? "configured",
        dimensions: embedding.length,
        status: "ready",
        embedding,
      });
      await db.update(knowledgeChunksTable).set({
        embedding,
        ...(embedding.length === 1536 ? { embeddingVector: embedding } : {}),
      }).where(eq(knowledgeChunksTable.id, chunk.id));
    }
    await db.update(knowledgeDocumentsTable).set({ status: "ready", updatedAt: new Date(), error: null }).where(eq(knowledgeDocumentsTable.id, document.id));
    return { id: document.id, status: "ready", chunks: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document ingestion failed";
    await db.update(knowledgeDocumentsTable).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(knowledgeDocumentsTable.id, document.id));
    return { id: document.id, status: "failed", chunks: 0, message };
  }
}

export async function searchKnowledge(input: {
  organizationId: string;
  projectId?: string;
  query: string;
  limit?: number;
  embeddings?: KnowledgeEmbeddingProvider;
  topK?: number;
}): Promise<KnowledgeSearchResult[]> {
  const limit = Math.min(Math.max(1, input.limit ?? input.topK ?? 5), 20);
  const normalized = input.query.trim();
  if (!normalized) return [];

  const embedder = input.embeddings ?? getConfiguredEmbeddingProvider();
  const queryVector = await embedder.embed(normalized);

  if (disabledDb) {
    const documents = disabledStore.documents.filter((document) => {
      const doc = document as Record<string, unknown>;
      if (String(doc.organizationId) !== input.organizationId) return false;
      if (input.projectId && document.projectId !== input.projectId) return false;
      if (String(doc.status) !== "ready") return false;
      return true;
    });
    const rows: KnowledgeSearchResult[] = [];
    for (const document of documents) {
      const storedChunks = disabledStore.chunks.filter((chunk) => String((chunk as any).documentId) === String((document as any).id));
      for (const chunk of storedChunks) {
        const chunkContent = String((chunk as any).content ?? "");
        const keywordScore = Math.min(1, normalized.toLowerCase().split(/\s+/).filter(Boolean).reduce((total, term) => total + (chunkContent.toLowerCase().includes(term) ? 1 : 0), 0) / Math.max(1, normalized.split(/\s+/).length));
        const embedding = Array.isArray((chunk as any).embedding) ? (chunk as any).embedding as number[] : [];
        const semanticScore = cosineSimilarity(queryVector, embedding);
        const score = Math.max(keywordScore, semanticScore);
        if (score <= 0) continue;
        rows.push({
          chunkId: String((chunk as any).id),
          documentId: String((document as any).id),
          title: String((document as any).title),
          content: chunkContent,
          source: String((document as any).source),
          score,
          metadata: (document as any).metadata ?? {},
        });
      }
    }
    return rows.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const queryTerms = normalized.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryVector.length === 1536) {
    const vectorLiteral = `[${queryVector.join(",")}]`;
    const semanticRows = await db.execute(sql`
      select chunk_id, document_id, title, content, source, score, metadata
      from public.hybrid_match_knowledge_chunks(
        ${vectorLiteral}::vector,
        ${normalized},
        ${input.organizationId}::uuid,
        ${input.projectId ? sql`${input.projectId}::uuid` : sql`null`},
        ${limit}
      )
    `);
    const semanticResults = semanticRows.rows as Array<{
      chunk_id: string;
      document_id: string;
      title: string;
      content: string;
      source: string;
      score: number | null;
      metadata: Record<string, unknown> | null;
    }>;
    return semanticResults.map((result) => ({
        chunkId: result.chunk_id,
        documentId: result.document_id,
        title: result.title,
        content: result.content,
        source: result.source,
        score: Number(result.score ?? 0),
        metadata: result.metadata ?? {},
      })).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  const scopeClauses = [eq(knowledgeDocumentsTable.organizationId, input.organizationId)];
  if (input.projectId) scopeClauses.push(eq(knowledgeDocumentsTable.projectId, input.projectId));
  scopeClauses.push(eq(knowledgeDocumentsTable.status, "ready"));

  const rows = await db.select({
    chunkId: knowledgeChunksTable.id,
    documentId: knowledgeDocumentsTable.id,
    title: knowledgeDocumentsTable.title,
    content: knowledgeChunksTable.content,
    source: knowledgeDocumentsTable.source,
    embedding: knowledgeChunksTable.embedding,
    embeddingVector: knowledgeChunksTable.embeddingVector,
    chunkMetadata: knowledgeChunksTable.metadata,
    metadata: knowledgeDocumentsTable.metadata,
  }).from(knowledgeChunksTable)
    .innerJoin(knowledgeDocumentsTable, eq(knowledgeDocumentsTable.id, knowledgeChunksTable.documentId))
    .where(and(...scopeClauses))
    .orderBy(desc(knowledgeChunksTable.createdAt));

  const mapped = rows.map((row) => {
    const content = row.content.toLowerCase();
    const keywordScore = queryTerms.reduce((total, term) => total + (content.includes(term) ? 1 : 0), 0) / Math.max(1, queryTerms.length);
    const semanticScore = cosineSimilarity(
      queryVector,
      Array.isArray(row.embeddingVector)
        ? row.embeddingVector
        : (Array.isArray(row.embedding) ? row.embedding : []),
    );
    return {
      chunkId: row.chunkId,
      documentId: row.documentId,
      title: row.title,
      content: row.content,
      source: row.source,
      score: Math.max(keywordScore, semanticScore),
      metadata: { ...(row.metadata ?? {}), chunk: row.chunkMetadata ?? {} },
    };
  }).filter((row) => row.score > 0);
  return mapped.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function saveKnowledgeMemory(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  scope?: "user" | "workspace" | "agent";
  kind?: string;
  source?: string;
  content: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}): Promise<Record<string, unknown>> {
  if (disabledDb) {
    const record = {
      id: makeId("mem"),
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      scope: input.scope ?? "workspace",
      kind: input.kind ?? "note",
      source: input.source ?? "agent",
      content: input.content,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: input.expiresAt ?? null,
    };
    disabledStore.memories.push(record);
    return record;
  }

  const [memory] = await db.insert(knowledgeMemoriesTable).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    scope: input.scope ?? "workspace",
    kind: input.kind ?? "note",
    source: input.source ?? "agent",
    content: input.content,
    metadata: input.metadata ?? {},
    expiresAt: input.expiresAt,
  }).returning();
  return memory as Record<string, unknown>;
}

export async function retrieveKnowledgeMemories(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  query?: string;
  limit?: number;
  scope?: "user" | "workspace" | "agent";
}): Promise<Array<Record<string, unknown>>> {
  const query = input.query?.trim().toLowerCase() ?? "";
  const now = new Date();
  if (disabledDb) {
    const memories = disabledStore.memories.filter((memory) => {
      const row = memory as Record<string, unknown>;
      if (String(row.organizationId) !== input.organizationId) return false;
      if (input.projectId && String(row.projectId ?? "") !== input.projectId) return false;
      if (input.scope && String(row.scope ?? "") !== input.scope) return false;
      if (input.userId && row.userId !== undefined && String(row.userId) !== input.userId && String(row.scope ?? "") !== "workspace") return false;
      if (row.expiresAt && new Date(String(row.expiresAt)) <= now) return false;
      return true;
    });
    const limit = Math.min(Math.max(1, input.limit ?? 5), 20);
    const filtered = !query
      ? memories
      : memories.filter((memory) => String((memory as any).content).toLowerCase().includes(query));
    return filtered.sort((a, b) => Number(new Date((b as any).createdAt)) - Number(new Date((a as any).createdAt))).slice(0, limit);
  }

  const conditions = [eq(knowledgeMemoriesTable.organizationId, input.organizationId)];
  conditions.push(or(sql`${knowledgeMemoriesTable.expiresAt} IS NULL`, sql`${knowledgeMemoriesTable.expiresAt} > NOW()`) ?? sql`TRUE`);
  if (input.projectId) conditions.push(eq(knowledgeMemoriesTable.projectId, input.projectId));
  if (input.scope) conditions.push(eq(knowledgeMemoriesTable.scope, input.scope));
  if (input.userId) {
    conditions.push(or(eq(knowledgeMemoriesTable.userId, input.userId), eq(knowledgeMemoriesTable.scope, "workspace")) ?? sql`TRUE`);
  }

  const whereClause = (conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
  const rows = await db.select().from(knowledgeMemoriesTable)
    .where(whereClause)
    .orderBy(desc(knowledgeMemoriesTable.updatedAt))
    .limit(Math.min(Math.max(1, input.limit ?? 5), 20));

  if (!query) return rows as Array<Record<string, unknown>>;
  return rows.filter((row) => String(row.content).toLowerCase().includes(query)) as Array<Record<string, unknown>>;
}

export async function saveAgentContext(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  requestHash: string;
  context: string;
  sources: string[];
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}): Promise<Record<string, unknown>> {
  if (disabledDb) {
    const record = {
      id: makeId("ctx"),
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      requestHash: input.requestHash,
      context: input.context,
      sources: input.sources,
      metadata: input.metadata ?? {},
      expiresAt: input.expiresAt ?? null,
      createdAt: new Date(),
    };
    disabledStore.context.push(record);
    return record;
  }

  const [record] = await db.insert(agentContextTable).values({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    requestHash: input.requestHash,
    context: input.context,
    sources: input.sources,
    metadata: input.metadata ?? {},
    expiresAt: input.expiresAt,
  }).returning();
  return record as Record<string, unknown>;
}

export async function buildKnowledgeContext(input: {
  organizationId: string;
  projectId?: string;
  userId?: string;
  query: string;
  limit?: number;
  embeddings?: KnowledgeEmbeddingProvider;
}): Promise<{ text: string; sources: string[]; results: KnowledgeSearchResult[]; memories: Array<Record<string, unknown>> }> {
  const results = await searchKnowledge({
    organizationId: input.organizationId,
    projectId: input.projectId,
    query: input.query,
    limit: input.limit ?? 5,
    embeddings: input.embeddings,
  });
  const memories = await retrieveKnowledgeMemories({
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    query: input.query,
    limit: 5,
  });

  const text = [
    ...results.map((result) => `[SOURCE:${result.title}] (${result.source})\n${result.content}`),
    ...memories.map((memory) => `[MEMORY:${String((memory as any).kind ?? "memory")}]\n${String((memory as any).content ?? "")}`),
  ].join("\n\n");

  return { text, sources: results.map((result) => result.source), results, memories };
}


/** Compatibility facade for the P1 agent runtime. */
export function createKnowledgeSearchProvider(options: { embeddings?: KnowledgeEmbeddingProvider } = {}) {
  return {
    search: (input: { organizationId: string; projectId?: string; query: string; limit: number }) =>
      searchKnowledge({ ...input, embeddings: options.embeddings }),
  };
}

/** Compatibility facade for the P1 agent context assembler. */
export async function assembleKnowledgeContext(input: {
  organizationId: string;
  projectId?: string;
  query: string;
  limit?: number;
  embeddings?: KnowledgeEmbeddingProvider;
  userId?: string;
}) {
  return buildKnowledgeContext(input);
}
