import { Hono } from "hono";
import {
  MagicLinkRequestSchema,
} from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { authService } from "../services/container.js";

export const authRoutes = new Hono<AppEnv>()
  .get("/auth/providers", async (c) =>
    respond(c, (await authService.getSessionState(null)).providers),
  )
  .get("/auth/session", async (c) =>
    respond(c, await authService.getSessionState(c.var.sessionToken)),
  )
  .post("/auth/magic-links/request", async (c) =>
    respond(c, await authService.requestMagicLink(await parseJson(c, MagicLinkRequestSchema)), 201),
  )
  .get("/auth/magic-links/verify", async (c) => {
    const token = c.req.query("token");
    const payload = await authService.verifyMagicLink(token ?? "");
    return c.redirect(payload.redirectUrl, 302);
  })
  .post("/auth/sign-out", async (c) =>
    respond(c, await authService.signOut(c.var.sessionToken)),
  );
