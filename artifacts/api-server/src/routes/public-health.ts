import { Router, type IRouter } from "express";
import { checkMetricsStorage } from "../lib/mcp/metrics";

const router: IRouter = Router();

router.get("/health", async (_req, res): Promise<void> => {
  const storageAvailable = await checkMetricsStorage();
  res.status(200).json({
    status: storageAvailable ? "ok" : "degraded",
    aggregateStorage: storageAvailable ? "available" : "unavailable",
  });
});

export default router;
