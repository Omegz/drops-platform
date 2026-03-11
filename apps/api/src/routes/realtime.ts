import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";
import { requireActiveRole, requireSession } from "../middleware/auth.js";
import { dispatchService, roleService } from "../services/container.js";

export const realtimeRoutes = new Hono<AppEnv>()
  .get("/realtime/tracking/:trackingToken/subscribe", async (c) =>
    respond(
      c,
      await dispatchService.getTrackingRealtimeCredentials(
        c.req.param("trackingToken"),
      ),
    ),
  )
  .use("/realtime/driver/subscribe", requireSession, requireActiveRole("driver"))
  .get("/realtime/driver/subscribe", async (c) =>
    respond(
      c,
      await dispatchService.getDriverRealtimeCredentials(
        await roleService.requireDriverId(c.var.session!),
      ),
    ),
  );
