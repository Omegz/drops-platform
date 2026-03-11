import { Hono } from "hono";
import { CreateOrderSchema } from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { requireActiveRole, requireSession } from "../middleware/auth.js";
import { customerOrderService } from "../services/container.js";

export const customerRoutes = new Hono<AppEnv>()
  .use("*", requireSession, requireActiveRole("customer"))
  .post("/customer/orders", async (c) =>
    respond(
      c,
      await customerOrderService.createOrderForSession(
        c.var.session!,
        await parseJson(c, CreateOrderSchema),
      ),
      201,
    ),
  )
  .get("/customer/orders/current", async (c) =>
    respond(c, await customerOrderService.getCurrentOrder(c.var.session!)),
  )
  .get("/customer/orders/:orderId", async (c) =>
    respond(
      c,
      await customerOrderService.getOrderById(
        c.var.session!,
        c.req.param("orderId"),
      ),
    ),
  );
