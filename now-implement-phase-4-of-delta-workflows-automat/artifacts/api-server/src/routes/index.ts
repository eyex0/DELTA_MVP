import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deltaRouter from "./delta";
import workflowRouter from "./workflows";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deltaRouter);
router.use(workflowRouter);

export default router;
