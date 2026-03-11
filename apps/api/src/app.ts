import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isAppError } from "./lib/http-error.js";
import { requestIdMiddleware, type AppEnv } from "./lib/request-context.js";
import { docsRoutes } from "./routes/docs.js";
import { driverRoutes } from "./routes/drivers.js";
import { healthRoutes } from "./routes/health.js";
import { internalRoutes } from "./routes/internal.js";
import { orderRoutes } from "./routes/orders.js";
import { realtimeRoutes } from "./routes/realtime.js";
import { trackingRoutes } from "./routes/tracking.js";

const app = new Hono<AppEnv>();

app.use("*", requestIdMiddleware);

app.route("/api/v1", healthRoutes);
app.route("/api/v1", docsRoutes);
app.route("/api/v1", driverRoutes);
app.route("/api/v1", orderRoutes);
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
