import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { router } from "./routes";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
  app.use(express.json({ limit: "200kb" }));
  app.use("/api", router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
