import { Hono } from "hono";
import {
  LogisticsPlaceSearchInputSchema,
  RoutePreviewInputSchema,
} from "@drops/contracts";
import type { AppEnv } from "../lib/request-context.js";
import { respond } from "../lib/response.js";
import { parseJson } from "../lib/validation.js";
import { logisticsService } from "../services/container.js";

export const logisticsRoutes = new Hono<AppEnv>()
  .post("/logistics/places/autocomplete", async (c) => {
    const input = await parseJson(c, LogisticsPlaceSearchInputSchema);

    return respond(
      c,
      await logisticsService.searchPlaces(input.query, {
        limit: input.limit,
        proximity: input.proximity,
      }),
    );
  })
  .post("/logistics/route-preview", async (c) => {
    const input = await parseJson(c, RoutePreviewInputSchema);
    return respond(c, await logisticsService.buildPreviewMap(input.pickup, input.dropoff));
  });
