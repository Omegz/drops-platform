import { Hono } from "hono";
import { CreateDriverInvitationSchema } from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { requireAdmin, requireSession } from "../middleware/auth.js";
import { driverInvitationService } from "../services/container.js";

export const adminRoutes = new Hono<AppEnv>()
  .use("*", requireSession, requireAdmin)
  .post("/admin/driver-invitations", async (c) =>
    respond(
      c,
      await driverInvitationService.createInvitation(
        c.var.session!,
        await parseJson(c, CreateDriverInvitationSchema),
      ),
      201,
    ),
  )
  .post("/admin/driver-invitations/:invitationId/approve", async (c) =>
    respond(
      c,
      await driverInvitationService.approveInvitation(
        c.var.session!,
        c.req.param("invitationId"),
      ),
    ),
  );
