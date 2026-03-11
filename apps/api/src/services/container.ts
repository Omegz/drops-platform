import { createCloudflareD1ClientFromEnv } from "../db/d1-client.js";
import { env } from "../lib/env.js";
import { AuthService } from "./auth/auth-service.js";
import { RoleService } from "./auth/role-service.js";
import {
  D1AuthRepository,
  InMemoryAuthRepository,
} from "./auth/repository.js";
import { CustomerOrderService } from "./customer-order-service.js";
import { DispatchService } from "./dispatch-service.js";
import { DriverInvitationService } from "./driver-invitation-service.js";
import { DriverOpsService } from "./driver-ops-service.js";
import { PushService } from "./push-service.js";
import {
  D1DispatchRepository,
  InMemoryDispatchRepository,
} from "./repository.js";
import { SaaSignalLogisticsService } from "./saasignal-logistics-service.js";
import { SaaSignalDispatchService } from "./saasignal-service.js";
import { CustomerWebhookService } from "./webhook-service.js";

const d1Client = createCloudflareD1ClientFromEnv();
const dispatchRepository = d1Client
  ? new D1DispatchRepository(d1Client)
  : new InMemoryDispatchRepository();
const authRepository = d1Client
  ? new D1AuthRepository(d1Client)
  : new InMemoryAuthRepository();
const pushService = new PushService(dispatchRepository);
const webhookService = new CustomerWebhookService();
const saasignalService = SaaSignalDispatchService.fromEnv();
const logisticsService = new SaaSignalLogisticsService(
  saasignalService ? "saasignal-logistics" : "local-fallback",
  saasignalService,
);

export const roleService = new RoleService(authRepository);
export const authService = new AuthService(authRepository, roleService);
export { logisticsService };
export const dispatchService = new DispatchService(
  dispatchRepository,
  pushService,
  webhookService,
  saasignalService,
  logisticsService,
  env.appBaseUrl,
);
export const customerOrderService = new CustomerOrderService(
  authRepository,
  dispatchService,
);
export const driverOpsService = new DriverOpsService(roleService, dispatchService);
export const driverInvitationService = new DriverInvitationService(
  roleService,
  authRepository,
);
