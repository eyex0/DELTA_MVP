import test from "node:test";
import assert from "node:assert/strict";

process.env.DISABLE_DB = "true";

const { ingestKnowledgeDocument, searchKnowledge, saveKnowledgeMemory, retrieveKnowledgeMemories } = await import("./knowledge");

test("ingestion and retrieval work in disabled-db mode for the test document", async () => {
  const organizationId = "org-knowledge-test-1";
  const projectId = "proj-knowledge-test-1";
  const result = await ingestKnowledgeDocument({
    organizationId,
    projectId,
    title: "DELTA_TEST_DOCUMENT",
    source: "DELTA_TEST_DOCUMENT.txt",
    sourceType: "text",
    content: "DELTA TEST CUSTOMER SUPPORT CODE: DX-47291",
  });

  assert.equal(result.status, "ready");
  assert.ok(result.id.length > 0);

  const matches = await searchKnowledge({
    organizationId,
    projectId,
    query: "customer support code",
    limit: 5,
  });

  assert.ok(matches.length > 0, "expected a searchable knowledge result");
  assert.ok(matches.some((match) => match.content.includes("DX-47291")));
});

test("cross-tenant knowledge search is isolated", async () => {
  const organizationId = "org-knowledge-test-2";
  const otherOrganizationId = "org-knowledge-test-3";
  const projectId = "proj-knowledge-test-2";

  await ingestKnowledgeDocument({
    organizationId,
    projectId,
    title: "Internal policy",
    source: "policy.txt",
    content: "DELTA TEST CUSTOMER SUPPORT CODE: DX-00001",
  });

  const matches = await searchKnowledge({
    organizationId: otherOrganizationId,
    projectId,
    query: "customer support code",
    limit: 5,
  });

  assert.deepEqual(matches, []);
});

test("workspace memory is stored and retrieved for the matching tenant", async () => {
  const organizationId = "org-memory-test";
  const projectId = "proj-memory-test";

  await saveKnowledgeMemory({
    organizationId,
    projectId,
    scope: "workspace",
    kind: "preference",
    source: "user",
    content: "Preferred weekly review format: short summary with action items.",
  });

  const memories = await retrieveKnowledgeMemories({
    organizationId,
    projectId,
    query: "weekly review",
    limit: 10,
  });

  assert.ok(memories.some((memory) => String(((memory as any).content ?? "")).includes("weekly review")));
});

test("expired memories are not returned", async () => {
  const organizationId = "org-memory-expiry-test";
  const projectId = "proj-memory-expiry-test";

  await saveKnowledgeMemory({
    organizationId,
    projectId,
    scope: "user",
    userId: "user-expiry-test",
    content: "This preference has expired.",
    expiresAt: new Date(Date.now() - 60_000),
  });

  const memories = await retrieveKnowledgeMemories({
    organizationId,
    projectId,
    userId: "user-expiry-test",
    query: "preference",
  });

  assert.equal(memories.some((memory) => String((memory as any).content).includes("expired")), false);
});
