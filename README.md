# Drops Platform

Monorepo for an Uber-style delivery platform with:

- `apps/api`: enterprise-style Hono API for dispatch, driver presence, offers, tracking, and outbound customer webhooks.
- `apps/driver-app`: Expo Router driver app that runs as a Vercel-hosted PWA now and can move to iOS/Android later.
- `packages/contracts`: shared Zod contracts used by both sides.

Provider split:

- Database: Cloudflare D1
- Compute and hosting: Vercel
- Realtime, delayed jobs, and logistics tracking: SaaSignal

## Architecture

### API

The API is organized around a thin-route and service-layer pattern:

- Driver presence: go online/offline, publish location, register push channels.
- Dispatch: create orders, rank candidate drivers, issue concurrent offers, handle accept/reject.
- Execution: advance orders through `accepted -> on_the_way -> picked_up -> dropped_off`.
- Tracking: return a public tracking snapshot backed by a tracking token.
- Customer sync: emit signed webhooks when key dispatch events occur.

Current storage is Cloudflare D1 through the Cloudflare REST API so the API can stay on Vercel while the canonical data stays on Cloudflare.
The repository auto-applies the D1 schema on first use when the Cloudflare env vars are present.

The API also uses SaaSignal in three ways:

- `infra.channels` for driver and tracking realtime streams
- `infra.jobs` for delayed offer expiry and retryable customer-webhook delivery
- `logistics.tracking` for driver position pings

### Driver app

The Expo app is designed as a field console:

- Online/offline toggle
- Automatic location heartbeat while online
- Offer inbox with accept/reject
- Active assignment cockpit with Google Maps deep links
- Public `/track/[token]` route for customer tracking
- PWA manifest + service worker for installable web delivery
- SaaSignal-backed realtime subscription with polling fallback

## Push strategy

The project uses two push channels because the web PWA and native app have different constraints:

- Web PWA: Web Push via service worker + VAPID keys
- Native iOS/Android later: Expo push tokens via `expo-notifications`

This split is intentional. The backend exposes one device-registration endpoint and stores either token shape.

## Project layout

```text
apps/
  api/
  driver-app/
packages/
  contracts/
```

## Environment

Copy the values from [.env.example](/Users/omar/workDevelopment/personalProjects/dropsAppApi/.env.example) into your local env setup.

Minimum useful local setup:

- `APP_BASE_URL=http://localhost:8081`
- `EXPO_PUBLIC_API_URL=http://localhost:3000`
- `EXPO_PUBLIC_DRIVER_ID=driver_demo_01`

For production-grade Cloudflare + SaaSignal + push:

- `API_BASE_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `INTERNAL_JOB_SECRET`
- `SAASIGNAL_API_KEY`
- `SAASIGNAL_API_URL`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `CUSTOMER_WEBHOOK_SIGNING_SECRET`
- `EXPO_PROJECT_ID`

## Local run

1. Install workspace dependencies with `pnpm install`
2. Start the API with `pnpm --filter @drops/api dev`
3. Start the driver app with `pnpm --filter @drops/driver-app dev`
4. Open the Expo web target or install the PWA locally

The API seeds demo drivers, so the default `driver_demo_01` id is ready immediately.
Use the “Dispatch demo order” action inside the app to simulate customer demand before the customer-facing product exists.

## Vercel deployment

Create two Vercel projects from the same repository:

1. API project
   Root directory: `apps/api`
2. Driver app project
   Root directory: `apps/driver-app`

Recommended env split:

- API project:
  `API_BASE_URL`, `APP_BASE_URL`, `CUSTOMER_WEBHOOK_SIGNING_SECRET`, `WEB_PUSH_*`, `EXPO_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`, `INTERNAL_JOB_SECRET`, `SAASIGNAL_API_KEY`, `SAASIGNAL_API_URL`
- Driver app project:
  `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_DRIVER_ID`

Recommended production URLs:

- API: `https://api.your-domain.com`
- Driver app / public tracking: `https://driver.your-domain.com`

Set:

- `API_BASE_URL=https://api.your-domain.com`
- `APP_BASE_URL=https://driver.your-domain.com`
- `EXPO_PUBLIC_API_URL=https://api.your-domain.com`

## Next production steps

- Add authenticated driver identity instead of environment-driven demo ids.
- Add a customer-facing app or website that consumes the webhook stream and tracking endpoint.
- Move the candidate scoring from haversine-only to SaaSignal routing or Google Routes ETA weighting once the provider credentials are finalized.
- Add signed admin routes for Cloudflare D1 migrations and SaaSignal project bootstrap if you want this repo to self-provision in CI.
