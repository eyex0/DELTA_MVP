import { Router, type IRouter } from "express";
import {
  buildBenchmarkDataset,
  evaluateProcessGraph,
  parseProcessText,
  migrateProcessGraph,
  validateProcessGraph,
} from "@workspace/ai";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function parseCanonicalGraph(value: unknown) {
  try {
    return { success: true as const, data: migrateProcessGraph(value) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Invalid process graph.",
    };
  }
}

router.post("/process/parse", requireAuth, (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : typeof req.body?.input === "string" ? req.body.input : "";
  const graph = parseProcessText(text);
  const validation = validateProcessGraph(graph);

  res.json({
    process: graph,
    validation,
    confidence: validation.confidence,
    metadata: {
      source: "process-intelligence" ,
      model: "delta-process-extractor",
    },
  });
});

router.post("/process/validate", requireAuth, (req, res) => {
  const candidate = req.body?.process ?? req.body?.graph;
  if (!candidate || typeof candidate !== "object") {
    return res.status(400).json({ error: "A process graph is required in the request body." });
  }

  const parsed = parseCanonicalGraph(candidate);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid process schema.",
      details: parsed.error,
    });
  }

  const validation = validateProcessGraph(parsed.data);
  return res.json({ process: parsed.data, validation });
});

router.post("/process/evaluate", requireAuth, (req, res) => {
  const candidate = req.body?.candidate ?? req.body?.modelOutput;
  const reference = req.body?.reference ?? req.body?.goldProcess ?? buildBenchmarkDataset()[0]?.goldProcess;

  if (!candidate || !reference) {
    return res.status(400).json({ error: "Both candidate and reference process graphs are required." });
  }

  const parsedCandidate = parseCanonicalGraph(candidate);
  const parsedReference = parseCanonicalGraph(reference);

  if (!parsedCandidate.success || !parsedReference.success) {
    return res.status(400).json({
      error: "Candidate or reference process graph is invalid.",
      details: {
        candidate: parsedCandidate.success ? null : parsedCandidate.error,
        reference: parsedReference.success ? null : parsedReference.error,
      },
    });
  }

  return res.json({
    metrics: evaluateProcessGraph(parsedCandidate.data, parsedReference.data),
    validation: validateProcessGraph(parsedCandidate.data),
  });
});

router.get("/benchmark/cases", requireAuth, (_req, res) => {
  res.json(buildBenchmarkDataset());
});

export default router;
