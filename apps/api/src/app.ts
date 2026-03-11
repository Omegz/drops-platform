import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "./lib/env.js";
import { isAppError } from "./lib/http-error.js";
import { requestIdMiddleware, type AppEnv } from "./lib/request-context.js";
import { optionalSessionMiddleware } from "./middleware/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { customerRoutes } from "./routes/customer.js";
import { docsRoutes } from "./routes/docs.js";
import { driverRoutes } from "./routes/driver.js";
import { healthRoutes } from "./routes/health.js";
import { internalRoutes } from "./routes/internal.js";
import { meRoutes } from "./routes/me.js";
import { realtimeRoutes } from "./routes/realtime.js";
import { trackingRoutes } from "./routes/tracking.js";

const app = new Hono<AppEnv>();
const corsOrigins = Array.from(
  new Set(
    [
      env.appBaseUrl.replace(/\/$/, ""),
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ].filter(Boolean),
  ),
);

app.use("*", requestIdMiddleware);
app.use(
  "/api/*",
  cors({
    origin: (origin) => (corsOrigins.includes(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use("*", optionalSessionMiddleware);

app.route("/api", authRoutes);
app.route("/api/v1", healthRoutes);
app.route("/api/v1", docsRoutes);
app.route("/api/v1", meRoutes);
app.route("/api/v1", customerRoutes);
app.route("/api/v1", driverRoutes);
app.route("/api/v1", adminRoutes);
app.route("/api/v1", trackingRoutes);
app.route("/api/v1", realtimeRoutes);
app.route("/api/v1", internalRoutes);

app.onError((error, c) => {
  if (isAppError(error)) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
        requestId: c.var.requestId,
      },
      {
        status: error.statusCode as ContentfulStatusCode,
      },
    );
  }

  console.error(error);

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
      requestId: c.var.requestId,
    },
    {
      status: 500,
    },
  );
});

export default app;
