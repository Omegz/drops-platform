import type {
  DemoDispatchBoard,
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

  async getPublicDispatchBoard(): Promise<DemoDispatchBoard> {
    const drivers = await this.dispatchService.listDrivers();
    const dashboards = await Promise.all(
      drivers.map((driver) => this.dispatchService.getDriverDashboard(driver.id)),
    );

    const orderedDashboards = dashboards.sort((left, right) => {
      const leftPriority = this.getBoardPriority(left);
      const rightPriority = this.getBoardPriority(right);

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return left.driver.name.localeCompare(right.driver.name);
    });

    return {
      generatedAt: new Date().toISOString(),
      primaryDriverId: orderedDashboards[0]?.driver.id ?? null,
      drivers: orderedDashboards,
    };
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

  private getBoardPriority(dashboard: Awaited<ReturnType<DispatchService["getDriverDashboard"]>>) {
    if (dashboard.activeAssignment) {
      return 3;
    }

    if (dashboard.offers.some((offer) => offer.status === "pending")) {
      return 2;
    }

    if (dashboard.driver.availability === "online") {
      return 1;
    }

    return 0;
  }
}
