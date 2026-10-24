import express, { type Express, type ErrorRequestHandler } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import mcpApp from "./lib/mcp/route";
import publicHealthRouter from "./routes/public-health";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "32kb" }));

app.use("/api", router);
app.use(publicHealthRouter);
app.use(mcpApp);

const publicErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = error?.type === "entity.too.large" ? 413 : 400;
  res.status(status).json({
    error: status === 413 ? "Request body is too large." : "Invalid request.",
  });
};
app.use(publicErrorHandler);

export default app;
