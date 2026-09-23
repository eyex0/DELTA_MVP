import { customType, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return String(value).slice(1, -1).split(",").filter(Boolean).map(Number);
  },
});

export const knowledgeDocumentsTable = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceType: text("source_type").notNull().default("text"),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index("knowledge_documents_org_idx").on(table.organizationId),
  projectIdx: index("knowledge_documents_project_idx").on(table.projectId),
}));

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  embedding: jsonb("embedding").$type<number[] | null>().default(null),
  embeddingVector: vector1536("embedding_vector"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeEmbeddingsTable = pgTable("knowledge_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
  chunkId: uuid("chunk_id").notNull().references(() => knowledgeChunksTable.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  dimensions: integer("dimensions").notNull(),
  status: text("status").notNull().default("pending"),
  embedding: jsonb("embedding").$type<number[] | null>().default(null),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeMemoriesTable = pgTable("knowledge_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  userId: uuid("user_id"),
  scope: text("scope").notNull().default("workspace"),
  kind: text("kind").notNull().default("note"),
  source: text("source").notNull().default("agent"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({
  organizationIdx: index("knowledge_memories_org_idx").on(table.organizationId),
  userIdx: index("knowledge_memories_user_idx").on(table.userId),
}));

export const agentContextTable = pgTable("agent_context", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  userId: uuid("user_id"),
  requestHash: text("request_hash").notNull(),
  context: text("context").notNull(),
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
