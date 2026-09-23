import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deltaRouter from "./delta";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deltaRouter);

export default router;
