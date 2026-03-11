import { Hono } from "hono";
import {
  DriverAvailabilitySchema,
  DriverDeviceRegistrationSchema,
  DriverLocationUpdateSchema,
  OfferDecisionSchema,
  OrderStatusUpdateSchema,
} from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { requireActiveRole, requireSession } from "../middleware/auth.js";
import { driverOpsService } from "../services/container.js";

export const driverRoutes = new Hono<AppEnv>()
  .use("*", requireSession, requireActiveRole("driver"))
  .get("/driver/dashboard", async (c) =>
    respond(c, await driverOpsService.getDashboard(c.var.session!)),
  )
  .post("/driver/status", async (c) =>
    respond(
      c,
      await driverOpsService.setAvailability(
        c.var.session!,
        await parseJson(c, DriverAvailabilitySchema),
      ),
    ),
  )
  .post("/driver/location", async (c) =>
    respond(
      c,
      await driverOpsService.updateLocation(
        c.var.session!,
        await parseJson(c, DriverLocationUpdateSchema),
      ),
    ),
  )
  .post("/driver/devices", async (c) =>
    respond(
      c,
      await driverOpsService.registerDevice(
        c.var.session!,
        await parseJson(c, DriverDeviceRegistrationSchema),
      ),
      201,
    ),
  )
  .post("/driver/offers/:orderId/decision", async (c) =>
    respond(
      c,
      await driverOpsService.respondToOffer(
        c.var.session!,
        c.req.param("orderId"),
        await parseJson(c, OfferDecisionSchema),
      ),
    ),
  )
  .post("/driver/orders/:orderId/status", async (c) =>
    respond(
      c,
      await driverOpsService.updateOrderStatus(
        c.var.session!,
        c.req.param("orderId"),
        await parseJson(c, OrderStatusUpdateSchema),
      ),
    ),
  );
