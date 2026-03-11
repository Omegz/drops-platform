import type {
  DriverAvailability,
  DriverDeviceRegistration,
  DriverLocationUpdate,
  OfferDecision,
  OrderStatusUpdate,
} from "@drops/contracts";
import type { RoleService } from "./auth/role-service.js";
import type { ResolvedSession } from "./auth/repository.js";
import type { DispatchService } from "./dispatch-service.js";

export class DriverOpsService {
  constructor(
    private readonly roleService: RoleService,
    private readonly dispatchService: DispatchService,
  ) {}

  async getDashboard(session: ResolvedSession) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.getDriverDashboard(driverId);
  }

  async setAvailability(session: ResolvedSession, availability: DriverAvailability) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.setDriverAvailability(driverId, availability);
  }

  async updateLocation(session: ResolvedSession, location: DriverLocationUpdate) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.updateDriverLocation(driverId, location);
  }

  async registerDevice(session: ResolvedSession, registration: DriverDeviceRegistration) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.registerDriverDevice(driverId, registration);
  }

  async respondToOffer(session: ResolvedSession, orderId: string, decision: OfferDecision) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.respondToOffer(driverId, orderId, decision);
  }

  async updateOrderStatus(
    session: ResolvedSession,
    orderId: string,
    update: OrderStatusUpdate,
  ) {
    const driverId = await this.roleService.requireDriverId(session);
    return this.dispatchService.updateOrderStatus(driverId, orderId, update);
  }
}
