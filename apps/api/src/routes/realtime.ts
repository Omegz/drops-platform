import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";
import { dispatchService } from "../services/container.js";

export const realtimeRoutes = new Hono<AppEnv>()
  .get("/realtime/drivers/:driverId/subscribe", async (c) =>
    respond(
      c,
      await dispatchService.getDriverRealtimeCredentials(c.req.param("driverId")),
    ),
  )
  .get("/realtime/tracking/:trackingToken/subscribe", async (c) =>
    respond(
      c,
      await dispatchService.getTrackingRealtimeCredentials(
        c.req.param("trackingToken"),
      ),
    ),
  );
