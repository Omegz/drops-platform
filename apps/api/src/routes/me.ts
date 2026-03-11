import { Hono } from "hono";
import { SwitchActiveRoleSchema } from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { requireSession } from "../middleware/auth.js";
import { roleService } from "../services/container.js";

export const meRoutes = new Hono<AppEnv>()
  .use("*", requireSession)
  .get("/me", (c) => respond(c, c.var.sessionView!))
  .post("/me/active-role", async (c) =>
    respond(
      c,
      await roleService.switchActiveRole(
        c.var.session!,
        (await parseJson(c, SwitchActiveRoleSchema)).role,
      ),
    ),
  );
