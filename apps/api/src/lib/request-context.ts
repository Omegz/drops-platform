import type { Context, MiddlewareHandler } from "hono";
import type { AppSession } from "@drops/contracts";
import type { ResolvedSession } from "../services/auth/repository.js";

export type AppContextState = {
  requestId: string;
  session: ResolvedSession | null;
  sessionView: AppSession | null;
  sessionToken: string | null;
};

export type AppEnv = {
  Variables: AppContextState;
};

export type AppContext = Context<AppEnv>;

export const requestIdMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

  c.set("requestId", requestId);
  c.set("session", null);
  c.set("sessionView", null);
  c.set("sessionToken", null);
  c.header("x-request-id", requestId);

  await next();
};
