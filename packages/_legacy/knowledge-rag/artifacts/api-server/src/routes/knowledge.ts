import { Router, type IRouter } from "express";
import { ingestKnowledgeDocument, searchKnowledge } from "@workspace/db";

const router: IRouter = Router();

function requiredHeader(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} header is required`);
  return value.trim();
}

router.post("/knowledge/documents", async (req, res) => {
  try {
    const organizationId = requiredHeader(req.header("x-organization-id"), "x-organization-id");
    const projectId = req.header("x-project-id")?.trim() || undefined;
    const { title, source, sourceType, content, metadata } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || typeof source !== "string" || !source.trim() || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "title, source, and content are required" });
    }

    const result = await ingestKnowledgeDocument({
      organizationId,
      projectId,
      title: title.trim(),
      source: source.trim(),
      sourceType: typeof sourceType === "string" ? sourceType : "text",
      content,
      metadata: metadata && typeof metadata === "object" ? metadata : undefined,
    });
    return res.status(result.status === "failed" ? 422 : 201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge document upload failed";
    return res.status(message.includes("header is required") ? 400 : 500).json({ error: message });
  }
});

router.get("/knowledge/search", async (req, res) => {
  try {
    const organizationId = requiredHeader(req.header("x-organization-id"), "x-organization-id");
    const projectId = req.header("x-project-id")?.trim() || undefined;
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const limit = typeof req.query.topK === "string" ? Number(req.query.topK) : 5;
    if (!query.trim()) return res.status(400).json({ error: "query is required" });
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return res.status(400).json({ error: "topK must be an integer from 1 to 20" });

    const results = await searchKnowledge({ organizationId, projectId, query, limit });
    return res.json({ query, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge search failed";
    return res.status(message.includes("header is required") ? 400 : 500).json({ error: message });
  }
});

export default router;
