import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import deltaRouter from "./delta";
import agentRouter from "./agent";
import workflowsRouter from "./workflows";
import platformRouter from "./platform";
import processIntelligenceRouter from "./process-intelligence";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(deltaRouter);
router.use(agentRouter);
router.use(workflowsRouter);
router.use(platformRouter);
router.use(processIntelligenceRouter);

export default router;
