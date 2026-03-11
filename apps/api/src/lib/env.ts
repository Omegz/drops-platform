const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value === "true";
};

const inferVercelBaseUrl = () => {
  const candidate =
    process.env.API_BASE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_BRANCH_URL ??
    process.env.VERCEL_URL;

  if (!candidate) {
    return undefined;
  }

  return candidate.startsWith("http")
    ? candidate.replace(/\/$/, "")
    : `https://${candidate.replace(/\/$/, "")}`;
};

const inferredBaseUrl = inferVercelBaseUrl();

export const env = {
  port: Number(process.env.PORT ?? 3000),
  apiBaseUrl: process.env.API_BASE_URL ?? inferredBaseUrl ?? "http://localhost:3000",
  appBaseUrl: process.env.APP_BASE_URL ?? inferredBaseUrl ?? "http://localhost:8081",
  adminEmails: process.env.ADMIN_EMAILS ?? "",
  authStateSecret:
    process.env.AUTH_STATE_SECRET ??
    process.env.INTERNAL_JOB_SECRET ??
    "local-dev-job-secret",
  customerWebhookSigningSecret: process.env.CUSTOMER_WEBHOOK_SIGNING_SECRET ?? "",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareD1DatabaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  internalJobSecret: process.env.INTERNAL_JOB_SECRET ?? "local-dev-job-secret",
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  saasignalApiKey: process.env.SAASIGNAL_API_KEY,
  saasignalApiUrl: process.env.SAASIGNAL_API_URL,
  useGoogleRoutes: toBoolean(process.env.USE_GOOGLE_ROUTES, false),
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY,
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY,
  webPushSubject: process.env.WEB_PUSH_SUBJECT ?? "mailto:ops@example.com",
};
