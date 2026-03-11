# Drops Platform

Unified dispatch monorepo for an Uber-like delivery product with:

- `apps/api`: Hono API on Vercel for auth, customer orders, driver operations, tracking, realtime credentials, webhooks, and dispatch orchestration
- `apps/app`: one Expo Router web/PWA app on Vercel that contains customer, driver, settings, and public tracking routes
- `packages/contracts`: shared Zod contracts for API and app
- `packages/ui`: gluestack-based shared design primitives
- `packages/maps`: shared night-map rendering primitives used by customer and driver flows
- `packages/auth-client`: bearer-token session storage helpers for the Expo app

Provider split:

- Database: Cloudflare D1
- Compute and hosting: Vercel
- Realtime, delayed jobs, and logistics abstraction: SaaSignal

## Current product shape

### API

The API follows a thin-route + service-layer pattern and now exposes:

- `/api/auth/*` for session state, magic-link request, verification, and sign-out
- `/api/v1/me` and `/api/v1/me/active-role` for role-aware session switching
- `/api/v1/customer/orders*` for authenticated customer order creation and live order lookup
- `/api/v1/driver/*` for dashboard, status, location, device registration, offer decisions, and status progression
- `/api/v1/admin/driver-invitations*` for invite-and-approve driver enablement
- `/api/v1/tracking/:trackingToken` and `/api/v1/realtime/*` for public/live tracking

Cloudflare D1 remains the canonical store. SaaSignal is used for channels, background jobs, and the current logistics abstraction layer that feeds route/ETA payloads to the frontend.

### App

The Expo app is now one unified surface, split by role:

- `/` public landing
- `/sign-in` magic-link sign-in
- `/customer` customer order creation and live order state
- `/driver` driver city map, incoming offer state, and active trip workflow
- `/settings` role switching and session controls
- `/track/[token]` public tracking view

The UI direction is a dark dispatch-control-room layout built on `gluestack-ui`, with full-screen map stages, bright pickup/dropoff emphasis, animated offer toast behavior, and swipe-based driver task progression.

## Project layout

```text
apps/
  api/
  app/
packages/
  auth-client/
  contracts/
  maps/
  ui/
```

## Environment

Copy [.env.example](/Users/omar/workDevelopment/personalProjects/dropsAppApi/.env.example) into your local env setup.

Minimum useful local setup:

- `APP_BASE_URL=http://localhost:8081`
- `EXPO_PUBLIC_API_URL=http://localhost:3000`
- `INTERNAL_JOB_SECRET=local-dev-job-secret`

Production-oriented variables:

- `API_BASE_URL`
- `APP_BASE_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID`
- `SAASIGNAL_API_KEY`
- `SAASIGNAL_API_URL`
- `CUSTOMER_WEBHOOK_SIGNING_SECRET`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`
- `WEB_PUSH_SUBJECT`
- `EXPO_PROJECT_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ADMIN_EMAILS`

## Local run

1. Install dependencies with `pnpm install`
2. Start the API with `pnpm --filter @drops/api dev`
3. Start the Expo app with `pnpm --filter @drops/app dev`
4. Open the Expo web target and sign in through the magic-link flow

Demo driver identities are seeded in the API and exposed on the sign-in screen:

- `driver_demo_01@drops.app`
- `driver_demo_02@drops.app`
- `driver_demo_03@drops.app`

## Vercel deployment

Create two Vercel projects from the same repository:

1. API project
   Root directory: `apps/api`
2. App project
   Root directory: `apps/app`

The repo now includes app-local Vercel config in:

- [apps/api/vercel.json](/Users/omar/workDevelopment/personalProjects/dropsAppApi/apps/api/vercel.json)
- [apps/app/vercel.json](/Users/omar/workDevelopment/personalProjects/dropsAppApi/apps/app/vercel.json)

Recommended production URLs:

- API: `https://api.your-domain.com`
- App: `https://app.your-domain.com`

Set:

- `API_BASE_URL=https://api.your-domain.com`
- `APP_BASE_URL=https://app.your-domain.com`
- `EXPO_PUBLIC_API_URL=https://api.your-domain.com`

## GitHub Actions deployment

The repo includes [deploy-vercel.yml](/Users/omar/workDevelopment/personalProjects/dropsAppApi/.github/workflows/deploy-vercel.yml), which deploys both workspaces to Vercel on every push to `main`.

Add these repository variables in GitHub Actions:

- `VERCEL_ORG_ID=team_gIwhdIPOC8NRivSrT5Myj6OT`
- `VERCEL_APP_PROJECT_ID=prj_9nuVd105hziFCutmWk7my9IVCHHg`
- `VERCEL_API_PROJECT_ID=prj_VIXEF98gmA3Am1YFeLQiXR1hkwpD`

Add this repository secret:

- `VERCEL_TOKEN`

The workflow uses the Vercel CLI in each workspace and runs:

- `vercel pull --environment=production`
- `vercel build --prod`
- `vercel deploy --prebuilt --prod`

## Verification

Current repo verification that passes:

- `pnpm --filter @drops/api typecheck`
- `pnpm --filter @drops/app typecheck`
- `pnpm typecheck`
- `pnpm build`

## Known follow-ups

- Google OAuth is not wired end-to-end yet; the current working auth path is magic-link sign-in.
- SaaSignal logistics is represented through the internal `SaaSignalLogisticsService` abstraction; direct provider-specific routing APIs are not yet integrated in this repo.
- Native iOS/Android packaging is still future work, but the unified Expo app and shared packages are structured for that split.
