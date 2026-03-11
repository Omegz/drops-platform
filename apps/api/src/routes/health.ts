import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";

export const healthRoutes = new Hono<AppEnv>().get("/health", (c) =>
  respond(c, {
    status: "ok",
    service: "drops-api",
    now: new Date().toISOString(),
  }),
);
