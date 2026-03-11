import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";
import { dispatchService } from "../services/container.js";

export const trackingRoutes = new Hono<AppEnv>().get("/tracking/:trackingToken", async (c) =>
  respond(c, await dispatchService.getTrackingByToken(c.req.param("trackingToken"))),
);
