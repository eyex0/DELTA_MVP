import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (_req, res) => {
  if (!pool) {
    const preview = process.env.DATABASE_URL === "DISABLE_DB" ||
      process.env.DISABLE_DB === "true";
    if (preview) {
      res.json({ status: "ok", database: "preview-disabled" });
      return;
    }
    res.status(503).json({
      status: "not_ready",
      database: "not_configured",
      error: "PostgreSQL is not configured",
    });
    return;
  }

  try {
    await pool.query("select 1");
    res.json({ status: "ok", database: "postgresql" });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      database: "unavailable",
      error: error instanceof Error ? error.message : "Database check failed",
    });
  }
});

export default router;
