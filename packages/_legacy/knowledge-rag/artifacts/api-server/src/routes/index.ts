import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deltaRouter from "./delta";
import knowledgeRouter from "./knowledge";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deltaRouter);
router.use(knowledgeRouter);

export default router;
