import { CreateOrderSchema } from "@drops/contracts";
import { Hono } from "hono";
import { respond } from "../lib/response.js";
import type { AppEnv } from "../lib/request-context.js";
import { parseJson } from "../lib/validation.js";
import { dispatchService } from "../services/container.js";

export const orderRoutes = new Hono<AppEnv>().post("/orders", async (c) =>
  respond(c, await dispatchService.createOrder(await parseJson(c, CreateOrderSchema)), 201),
);
