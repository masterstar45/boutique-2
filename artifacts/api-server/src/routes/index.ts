import { Router, type IRouter } from "express";
import healthRouter from "./health";
import boutiqueRouter from "./boutique";

const router: IRouter = Router();

router.use(healthRouter);
router.use(boutiqueRouter);

export default router;
