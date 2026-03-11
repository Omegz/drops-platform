import type { Context } from "hono";
import { ZodError, type z } from "zod";
import { AppError } from "./http-error.js";
import type { AppEnv } from "./request-context.js";

export const parseJson = async <T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
) => {
  try {
    return schema.parse(await c.req.json());
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request");
    }

    throw error;
  }
};
