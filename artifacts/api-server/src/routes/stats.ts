import { Router, type IRouter } from "express";
import { GetPublicStatsResponse } from "@workspace/api-zod";
import { getPublicStats } from "../lib/mcp/metrics";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const response = GetPublicStatsResponse.parse(await getPublicStats());
    res.json(response);
  } catch {
    res.status(503).json({ error: "Temporarily unavailable" });
  }
});

export default router;
