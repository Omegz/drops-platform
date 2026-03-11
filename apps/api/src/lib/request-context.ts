import type { Context, MiddlewareHandler } from "hono";

export type AppContextState = {
  requestId: string;
};

export type AppEnv = {
  Variables: AppContextState;
};

export type AppContext = Context<AppEnv>;

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();
};
