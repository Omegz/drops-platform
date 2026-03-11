import { createCloudflareD1ClientFromEnv } from "./d1-client.js";

const client = createCloudflareD1ClientFromEnv();

if (!client) {
  throw new Error(
    "Cloudflare D1 env vars are required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_D1_DATABASE_ID",
  );
}

await client.applySchema();

console.log("Cloudflare D1 schema applied successfully.");
