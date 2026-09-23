import { customType, integer, jsonb, pgTable, text, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

const vector = customType<{ data: number[] | null; driverData: string | null }>({
  dataType: () => "vector",
  toDriver: (value) => value ? `[${value.join(",")}]` : null,
  fromDriver: (value) => value ? String(value).slice(1, -1).split(",").map(Number) : null,
});

export const knowledgeDocumentsTable = pgTable("knowledge_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  title: text("title").notNull(),
  source: text("source").notNull(),
  sourceType: text("source_type").notNull().default("text"),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index("knowledge_documents_organization_idx").on(table.organizationId),
  projectIdx: index("knowledge_documents_project_idx").on(table.organizationId, table.projectId, table.updatedAt),
}));

export const knowledgeChunksTable = pgTable("knowledge_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").notNull().references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count").notNull(),
  embedding: vector("embedding"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  documentOrderIdx: uniqueIndex("knowledge_chunks_document_order_idx").on(table.documentId, table.chunkIndex),
}));

export const knowledgeMemoriesTable = pgTable("knowledge_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  userId: uuid("user_id"),
  kind: text("kind").notNull().default("note"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  organizationIdx: index("knowledge_memories_organization_idx").on(table.organizationId, table.projectId, table.createdAt),
}));

export const agentContextTable = pgTable("agent_context", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id"),
  requestHash: text("request_hash").notNull(),
  context: text("context").notNull(),
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
