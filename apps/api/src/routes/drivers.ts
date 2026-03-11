import {
  DriverAvailabilitySchema,
  DriverDeviceRegistrationSchema,
  DriverLocationUpdateSchema,
  OfferDecisionSchema,
  OrderStatusUpdateSchema,
} from "@drops/contracts";
import { Hono } from "hono";
import { dispatchService } from "../services/container.js";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";
import { parseJson } from "../lib/validation.js";

export const driverRoutes = new Hono<AppEnv>()
  .get("/drivers", async (c) => respond(c, await dispatchService.listDrivers()))
  .get("/drivers/:driverId/dashboard", async (c) =>
    respond(c, await dispatchService.getDriverDashboard(c.req.param("driverId"))),
  )
  .post("/drivers/:driverId/status", async (c) => {
    const body = await parseJson(c, DriverAvailabilitySchema.transform((availability) => ({ availability })));

    return respond(
      c,
      await dispatchService.setDriverAvailability(
        c.req.param("driverId"),
        body.availability,
      ),
    );
  })
  .post("/drivers/:driverId/location", async (c) =>
    respond(
      c,
      await dispatchService.updateDriverLocation(
        c.req.param("driverId"),
        await parseJson(c, DriverLocationUpdateSchema),
      ),
    ),
  )
  .post("/drivers/:driverId/devices", async (c) =>
    respond(
      c,
      await dispatchService.registerDriverDevice(
        c.req.param("driverId"),
        await parseJson(c, DriverDeviceRegistrationSchema),
      ),
      201,
    ),
  )
  .post("/drivers/:driverId/offers/:orderId/decision", async (c) =>
    respond(
      c,
      await dispatchService.respondToOffer(
        c.req.param("driverId"),
        c.req.param("orderId"),
        await parseJson(c, OfferDecisionSchema),
      ),
    ),
  )
  .post("/drivers/:driverId/orders/:orderId/status", async (c) =>
    respond(
      c,
      await dispatchService.updateOrderStatus(
        c.req.param("driverId"),
        c.req.param("orderId"),
        await parseJson(c, OrderStatusUpdateSchema),
      ),
    ),
  );
