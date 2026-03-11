import { createCloudflareD1ClientFromEnv } from "../db/d1-client.js";
import { env } from "../lib/env.js";
import { DispatchService } from "./dispatch-service.js";
import { PushService } from "./push-service.js";
import {
  D1DispatchRepository,
  InMemoryDispatchRepository,
} from "./repository.js";
import { SaaSignalDispatchService } from "./saasignal-service.js";
import { CustomerWebhookService } from "./webhook-service.js";

const d1Client = createCloudflareD1ClientFromEnv();
const repository = d1Client
  ? new D1DispatchRepository(d1Client)
  : new InMemoryDispatchRepository();
const pushService = new PushService(repository);
const webhookService = new CustomerWebhookService();
const saasignalService = SaaSignalDispatchService.fromEnv();

export const dispatchService = new DispatchService(
  repository,
  pushService,
  webhookService,
  saasignalService,
  env.appBaseUrl,
);
