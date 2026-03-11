import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";

export const docsRoutes = new Hono<AppEnv>().get("/docs", (c) =>
  respond(c, {
    product: "Drops dispatch platform",
    version: "0.1.0",
    surfaces: [
      {
        operationId: "listDrivers",
        method: "GET",
        path: "/api/v1/drivers",
        summary: "List drivers and current online/offline state.",
      },
      {
        operationId: "getDriverDashboard",
        method: "GET",
        path: "/api/v1/drivers/:driverId/dashboard",
        summary: "Get driver offers and active assignment state for the driver app.",
      },
      {
        operationId: "setDriverAvailability",
        method: "POST",
        path: "/api/v1/drivers/:driverId/status",
        summary: "Set whether a driver is online and eligible for dispatch.",
      },
      {
        operationId: "updateDriverLocation",
        method: "POST",
        path: "/api/v1/drivers/:driverId/location",
        summary: "Send the latest driver location for scoring and live tracking.",
      },
      {
        operationId: "registerDriverDevice",
        method: "POST",
        path: "/api/v1/drivers/:driverId/devices",
        summary: "Register Expo or web push channels for job notifications.",
      },
      {
        operationId: "createOrder",
        method: "POST",
        path: "/api/v1/orders",
        summary: "Create a delivery job and allocate the best matching drivers.",
      },
      {
        operationId: "respondToOffer",
        method: "POST",
        path: "/api/v1/drivers/:driverId/offers/:orderId/decision",
        summary: "Accept or reject an incoming order offer.",
      },
      {
        operationId: "updateOrderStatus",
        method: "POST",
        path: "/api/v1/drivers/:driverId/orders/:orderId/status",
        summary: "Advance the order through accepted, on_the_way, picked_up, and dropped_off.",
      },
      {
        operationId: "getTrackingSnapshot",
        method: "GET",
        path: "/api/v1/tracking/:trackingToken",
        summary: "Return the current tracking state for the customer-facing tracking URL.",
      },
      {
        operationId: "getDriverRealtimeCredentials",
        method: "GET",
        path: "/api/v1/realtime/drivers/:driverId/subscribe",
        summary: "Mint a browser-safe SaaSignal subscribe URL for the driver channel.",
      },
      {
        operationId: "getTrackingRealtimeCredentials",
        method: "GET",
        path: "/api/v1/realtime/tracking/:trackingToken/subscribe",
        summary: "Mint a browser-safe SaaSignal subscribe URL for the public tracking channel.",
      },
    ],
    webhooks: [
      {
        event: "order.offer_sent",
      },
      {
        event: "order.accepted",
      },
      {
        event: "order.status_changed",
      },
      {
        event: "order.driver_location_updated",
      },
    ],
    notifications: {
      native: "expo push tokens",
      web: "web push subscriptions",
    },
    providers: {
      database: "Cloudflare D1",
      compute: ["Vercel", "SaaSignal jobs", "SaaSignal channels"],
      logistics: ["SaaSignal tracking"],
    },
  }),
);
