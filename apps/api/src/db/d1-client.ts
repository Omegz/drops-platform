import { env } from "../lib/env.js";
import { AppError } from "../lib/http-error.js";
import { d1SchemaStatements, seedDriverStatements } from "./schema.js";

type D1SingleResult<T> = {
  success: boolean;
  results: T[];
  meta: {
    changes?: number;
    duration?: number;
  };
};

type D1Response<T> = {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: D1SingleResult<T>[];
};

type BatchStatement = {
  sql: string;
  params?: Array<string | number | null>;
};

export class CloudflareD1Client {
  private initPromise: Promise<void> | null = null;

  constructor(
    private readonly accountId: string,
    private readonly apiToken: string,
    private readonly databaseId: string,
  ) {}

  async queryMany<T>(
    sql: string,
    params: Array<string | number | null> = [],
  ): Promise<T[]> {
    await this.ensureInitialized();

    const payload = await this.request<T>({ sql, params });
    return payload.result[0]?.results ?? [];
  }

  async queryOne<T>(
    sql: string,
    params: Array<string | number | null> = [],
  ): Promise<T | null> {
    const results = await this.queryMany<T>(sql, params);
    return results[0] ?? null;
  }

  async execute(
    sql: string,
    params: Array<string | number | null> = [],
  ): Promise<void> {
    await this.ensureInitialized();
    await this.request({ sql, params });
  }

  async batch(statements: BatchStatement[]) {
    await this.ensureInitialized();
    await this.request({
      batch: statements.map((statement) => ({
        sql: statement.sql,
        params: statement.params ?? [],
      })),
    });
  }

  async applySchema() {
    await this.request({
      batch: [
        ...d1SchemaStatements.map((sql) => ({ sql, params: [] })),
        ...seedDriverStatements,
      ],
    });
  }

  private async ensureInitialized() {
    if (!this.initPromise) {
      this.initPromise = this.applySchema();
    }

    await this.initPromise;
  }

  private async request<T>(
    body:
      | { sql: string; params?: Array<string | number | null> }
      | { batch: BatchStatement[] },
  ): Promise<D1Response<T>> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const payload = (await response.json()) as D1Response<T> & {
      messages?: unknown[];
    };

    if (!response.ok || !payload.success) {
      const firstError = payload.errors?.[0];
      throw new AppError(
        502,
        "D1_QUERY_FAILED",
        firstError?.message ?? "Cloudflare D1 request failed.",
      );
    }

    return payload;
  }
}

export const createCloudflareD1ClientFromEnv = () => {
  if (
    !env.cloudflareAccountId ||
    !env.cloudflareApiToken ||
    !env.cloudflareD1DatabaseId
  ) {
    return null;
  }

  return new CloudflareD1Client(
    env.cloudflareAccountId,
    env.cloudflareApiToken,
    env.cloudflareD1DatabaseId,
  );
};
