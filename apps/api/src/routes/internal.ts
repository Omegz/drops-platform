import { z } from "zod";
import { Hono } from "hono";
import { AppError } from "../lib/http-error.js";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { env } from "../lib/env.js";
import { dispatchService } from "../services/container.js";

const OfferExpiryJobSchema = z.object({
  orderId: z.string().min(1),
  driverId: z.string().min(1),
});

const CustomerWebhookJobSchema = z.object({
  targetUrl: z.string().url(),
  event: z.string().min(1),
  orderId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

const assertInternalJobToken = (token: string | undefined) => {
  if (!token || token !== env.internalJobSecret) {
    throw new AppError(403, "INVALID_INTERNAL_JOB_TOKEN", "Invalid internal job token.");
  }
};

export const internalRoutes = new Hono<AppEnv>()
  .post("/internal/jobs/offers/expire", async (c) => {
    assertInternalJobToken(c.req.query("token"));
    const payload = await parseJson(c, OfferExpiryJobSchema);
    return respond(
      c,
      await dispatchService.expireOffer(payload.orderId, payload.driverId),
      202,
    );
  })
  .post("/internal/jobs/customer-webhook", async (c) => {
    assertInternalJobToken(c.req.query("token"));
    return respond(
      c,
      await dispatchService.runCustomerWebhookJob(
        await parseJson(c, CustomerWebhookJobSchema),
      ),
      202,
    );
  });
