import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Context } from "hono";
import type { AppEnv } from "./request-context.js";

export const respond = <T>(
  c: Context<AppEnv>,
  data: T,
  status: ContentfulStatusCode = 200,
) =>
  c.json(
    {
      data,
      requestId: c.var.requestId,
    },
    {
      status,
    },
  );
