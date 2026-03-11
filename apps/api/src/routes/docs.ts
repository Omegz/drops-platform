import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";

export const docsRoutes = new Hono<AppEnv>().get("/docs", (c) =>
  respond(c, {
    product: "Drops unified dispatch platform",
    version: "0.3.0",
    surfaces: [
      {
        operationId: "getAuthProviders",
        method: "GET",
        path: "/api/auth/providers",
        summary: "Read which auth providers are active for the shared customer and driver app.",
      },
      {
        operationId: "requestMagicLink",
        method: "POST",
        path: "/api/auth/magic-links/request",
        summary: "Request a sign-in magic link for the shared customer and driver app.",
      },
      {
        operationId: "startGoogleAuth",
        method: "GET",
        path: "/api/auth/google/start",
        summary: "Start the Google OAuth flow and return to the shared app with a bearer session.",
      },
      {
        operationId: "getSession",
        method: "GET",
        path: "/api/auth/session",
        summary: "Resolve the current bearer token into session and role state.",
      },
      {
        operationId: "getMe",
        method: "GET",
        path: "/api/v1/me",
        summary: "Return the current signed-in user, available roles, and active role.",
      },
      {
        operationId: "switchActiveRole",
        method: "POST",
        path: "/api/v1/me/active-role",
        summary: "Switch the active role between customer and driver when allowed.",
      },
      {
        operationId: "createCustomerOrder",
        method: "POST",
        path: "/api/v1/customer/orders",
        summary: "Create a new dispatch order from the customer flow.",
      },
      {
        operationId: "getCurrentCustomerOrder",
        method: "GET",
        path: "/api/v1/customer/orders/current",
        summary: "Get the current active customer order and live tracking state.",
      },
      {
        operationId: "getCustomerOrder",
        method: "GET",
        path: "/api/v1/customer/orders/:orderId",
        summary: "Get a specific authenticated customer order and its tracking payload.",
      },
      {
        operationId: "getDriverDashboard",
        method: "GET",
        path: "/api/v1/driver/dashboard",
        summary: "Get incoming offers and the active assignment for the signed-in driver.",
      },
      {
        operationId: "setDriverAvailability",
        method: "POST",
        path: "/api/v1/driver/status",
        summary: "Mark the signed-in driver online or offline.",
      },
      {
        operationId: "respondToOffer",
        method: "POST",
        path: "/api/v1/driver/offers/:orderId/decision",
        summary: "Accept or reject an order offer for the signed-in driver.",
      },
      {
        operationId: "updateDriverOrderStatus",
        method: "POST",
        path: "/api/v1/driver/orders/:orderId/status",
        summary: "Advance an accepted order through the pickup and dropoff flow.",
      },
      {
        operationId: "getDriverRealtimeCredentials",
        method: "GET",
        path: "/api/v1/realtime/driver/subscribe",
        summary: "Mint browser-safe realtime credentials for the driver-specific dispatch stream.",
      },
      {
        operationId: "createDriverInvitation",
        method: "POST",
        path: "/api/v1/admin/driver-invitations",
        summary: "Invite a new driver account and reserve driver role access.",
      },
      {
        operationId: "approveDriverInvitation",
        method: "POST",
        path: "/api/v1/admin/driver-invitations/:invitationId/approve",
        summary: "Approve a pending driver invitation and provision the driver mapping.",
      },
      {
        operationId: "getTrackingSnapshot",
        method: "GET",
        path: "/api/v1/tracking/:trackingToken",
        summary: "Return the public tracking state and route map payload.",
      },
      {
        operationId: "getTrackingRealtimeCredentials",
        method: "GET",
        path: "/api/v1/realtime/tracking/:trackingToken/subscribe",
        summary: "Mint browser-safe realtime credentials for the public tracking stream.",
      },
    ],
    providers: {
      database: "Cloudflare D1",
      compute: ["Vercel", "SaaSignal channels", "SaaSignal jobs"],
      auth: ["Resend magic links", "Google OAuth", "role-aware bearer sessions"],
      logistics: [
        "SaaSignal SDK for routing, delivery dispatch, and live tracking",
        "Google Maps handoff for driver navigation only",
      ],
    },
  }),
);
