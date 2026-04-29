import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import evidenceRouter from "./evidence";
import timelineRouter from "./timeline";
import transcriptsRouter from "./transcripts";
import exportsRouter from "./exports";
import storageRouter from "./storage";
import emailRouter from "./email";
import textMessagesRouter from "./text-messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(evidenceRouter);
router.use(timelineRouter);
router.use(transcriptsRouter);
router.use(exportsRouter);
router.use(storageRouter);
router.use(emailRouter);
router.use(textMessagesRouter);

export default router;
