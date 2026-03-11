import type { MiddlewareHandler } from "hono";
import { AppError } from "../lib/http-error.js";
import type { AppEnv } from "../lib/request-context.js";
import { authService, roleService } from "../services/container.js";

const readBearerToken = (authorization: string | undefined) => {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
};

export const optionalSessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readBearerToken(c.req.header("authorization"));
  const resolved = await authService.resolveSession(token);
  const state = await roleService.toSessionState(resolved);

  c.set("sessionToken", token);
  c.set("session", resolved);
  c.set("sessionView", state.session);

  await next();
};

export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.session || !c.var.sessionView) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in is required.");
  }

  await next();
};

export const requireActiveRole = (role: "customer" | "driver"): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!c.var.sessionView) {
      throw new AppError(401, "UNAUTHENTICATED", "Sign in is required.");
    }

    if (c.var.sessionView.activeRole !== role) {
      throw new AppError(
        403,
        "ROLE_MISMATCH",
        `Active role must be ${role} to access this resource.`,
      );
    }

    await next();
  };

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.session) {
    throw new AppError(401, "UNAUTHENTICATED", "Sign in is required.");
  }

  await roleService.requireAdmin(c.var.session);
  await next();
};
