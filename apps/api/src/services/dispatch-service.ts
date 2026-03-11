import type {
  CustomerOrderView,
  DispatchCandidate,
  DispatchDecision,
  Driver,
  DriverDashboard,
  DriverDeviceRegistration,
  DriverLocationUpdate,
  NavigationLinks,
  Offer,
  OfferDecision,
  Order,
  OrderStatus,
  OrderStatusUpdate,
  TrackingSnapshot,
} from "@drops/contracts";
import { AppError } from "../lib/http-error.js";
import { createId } from "../lib/id.js";
import {
  buildGoogleMapsDirectionsUrl,
  buildTrackingUrl,
} from "../lib/navigation.js";
import { PushService } from "./push-service.js";
import type {
  CandidateDriverRecord,
  DispatchRepository,
} from "./repository.js";
import { SaaSignalLogisticsService } from "./saasignal-logistics-service.js";
import { SaaSignalDispatchService } from "./saasignal-service.js";
import { CustomerWebhookService } from "./webhook-service.js";

const offerWindowMs = 90_000;

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending_assignment: ["offer_sent", "no_driver_found"],
  offer_sent: ["accepted", "no_driver_found", "cancelled"],
  accepted: ["on_the_way", "cancelled"],
  on_the_way: ["picked_up", "cancelled"],
  picked_up: ["dropped_off", "cancelled"],
  dropped_off: [],
  cancelled: [],
  no_driver_found: [],
};

type CustomerWebhookJobPayload = {
  targetUrl: string;
  event: string;
  orderId: string;
  payload: Record<string, unknown>;
};

export class DispatchService {
  constructor(
    private readonly repository: DispatchRepository,
    private readonly pushService: PushService,
    private readonly webhookService: CustomerWebhookService,
    private readonly saasignalService: SaaSignalDispatchService | null,
    private readonly logisticsService: SaaSignalLogisticsService,
    private readonly appBaseUrl: string,
  ) {}

  async listDrivers() {
    return this.repository.listDrivers();
  }

  async setDriverAvailability(driverId: string, availability: "online" | "offline") {
    const driver = await this.repository.setDriverAvailability(driverId, availability);

    await this.publishDriverEvent(driverId, "driver.availability.changed", {
      driverId,
      availability,
    });

    return driver;
  }

  async updateDriverLocation(driverId: string, location: DriverLocationUpdate) {
    const driver = await this.repository.updateDriverLocation(driverId, location);
    const activeOrder = await this.repository.getDriverActiveOrder(driverId);

    if (this.saasignalService) {
      await this.saasignalService.trackDriver(driverId, location).catch(() => undefined);
    }

    await this.publishDriverEvent(driverId, "driver.location.updated", {
      driverId,
      point: location.point,
    });

    if (activeOrder) {
      await this.emitOrderSignal(activeOrder, "order.driver_location_updated", {
        driverId,
        point: location.point,
        status: activeOrder.status,
      });
    }

    return driver;
  }

  async registerDriverDevice(
    driverId: string,
    registration: DriverDeviceRegistration,
  ) {
    await this.repository.registerDriverDevice(driverId, registration);
    return {
      ok: true,
    };
  }

  async getDriverDashboard(driverId: string): Promise<DriverDashboard> {
    const driver = await this.repository.getDriver(driverId);
    const offers = await this.repository.listDriverOffers(driverId);
    const activeOrder = await this.repository.getDriverActiveOrder(driverId);

    return {
      driver,
      offers,
      activeAssignment: activeOrder
        ? {
            order: activeOrder,
            tracking: await this.getTrackingByToken(activeOrder.trackingToken),
            navigation: this.buildNavigation(activeOrder),
          }
        : null,
    };
  }

  async createOrder(
    input: Parameters<DispatchRepository["createOrder"]>[0],
  ): Promise<DispatchDecision> {
    const trackingToken = createId("trk");
    const order = await this.repository.createOrder(input, trackingToken);
    const candidates = await this.rankCandidates(order);

    if (!candidates.length) {
      const unassignedOrder = await this.repository.updateOrderStatus(
        order.id,
        "no_driver_found",
      );
      await this.repository.addOrderEvent({
        orderId: order.id,
        status: "no_driver_found",
        happenedAt: new Date().toISOString(),
        note: "No online drivers were available for this request.",
      });
      await this.emitOrderSignal(unassignedOrder, "order.unassigned", {
        reason: "no_online_drivers",
      });

      return {
        order: unassignedOrder,
        selectedOffer: null,
        sentOfferDriverIds: [],
        alternatives: [],
      };
    }

    const offers = candidates.slice(0, 3).map<Offer>((candidate) => ({
      orderId: order.id,
      driverId: candidate.driverId,
      status: "pending",
      score: candidate.score,
      pickupDistanceKm: candidate.distanceKm,
      pickup: order.pickup,
      dropoff: order.dropoff,
      offeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + offerWindowMs).toISOString(),
    }));

    await this.repository.saveOffers(order.id, offers);
    await this.repository.addOrderEvent({
      orderId: order.id,
      status: "offer_sent",
      happenedAt: new Date().toISOString(),
      note: `Sent offers to ${offers.length} drivers.`,
    });

    await Promise.allSettled(
      offers.map(async (offer) => {
        await this.pushService.sendOrderOffer(offer.driverId, order, offer);
        if (this.saasignalService) {
          await this.saasignalService.scheduleOfferExpiry(
            {
              orderId: offer.orderId,
              driverId: offer.driverId,
            },
            offer,
          );
        }
      }),
    );

    const refreshedOrder = await this.repository.getOrder(order.id);
    await this.emitOrderSignal(refreshedOrder, "order.offer_sent", {
      driverIds: offers.map((offer) => offer.driverId),
      topScore: offers[0]?.score ?? null,
      trackingUrl: buildTrackingUrl(this.appBaseUrl, order.trackingToken),
    });

    return {
      order: refreshedOrder,
      selectedOffer: candidates[0] ?? null,
      sentOfferDriverIds: offers.map((offer) => offer.driverId),
      alternatives: candidates.slice(1, 3),
    };
  }

  async respondToOffer(
    driverId: string,
    orderId: string,
    decision: OfferDecision,
  ) {
    const order = await this.repository.getOrder(orderId);
    const offers = await this.repository.listOrderOffers(orderId);
    const targetedOffer = offers.find((offer) => offer.driverId === driverId);

    if (!targetedOffer) {
      throw new AppError(404, "OFFER_NOT_FOUND", "No offer was found for this driver.");
    }

    if (targetedOffer.status !== "pending") {
      throw new AppError(409, "OFFER_ALREADY_RESOLVED", "This order offer is no longer pending.");
    }

    if (decision.decision === "reject") {
      await this.repository.updateOfferStatus(orderId, driverId, "rejected");
      await this.repository.addOrderEvent({
        orderId,
        status: order.status,
        happenedAt: new Date().toISOString(),
        note: `Driver ${driverId} rejected the offer.`,
      });

      const pendingOffers = (await this.repository.listOrderOffers(orderId)).filter(
        (offer) => offer.status === "pending",
      );

      if (!pendingOffers.length && !order.assignedDriverId) {
        const noDriverOrder = await this.repository.updateOrderStatus(
          orderId,
          "no_driver_found",
        );
        await this.repository.addOrderEvent({
          orderId,
          status: "no_driver_found",
          happenedAt: new Date().toISOString(),
          note: "All dispatched offers were rejected or expired.",
        });
        await this.emitOrderSignal(noDriverOrder, "order.unassigned", {
          reason: "all_offers_rejected",
        });
      } else {
        await this.emitOrderSignal(order, "order.offer_rejected", {
          driverId,
        });
      }

      return this.getDriverDashboard(driverId);
    }

    if (order.assignedDriverId && order.assignedDriverId !== driverId) {
      throw new AppError(409, "ORDER_ALREADY_ASSIGNED", "Another driver already accepted this order.");
    }

    await this.repository.updateOfferStatus(orderId, driverId, "accepted");
    await Promise.all(
      offers
        .filter((offer) => offer.driverId !== driverId && offer.status === "pending")
        .map((offer) =>
          this.repository.updateOfferStatus(orderId, offer.driverId, "expired"),
        ),
    );

    const assignedOrder = await this.repository.assignOrder(orderId, driverId);
    await this.repository.addOrderEvent({
      orderId,
      status: "accepted",
      happenedAt: new Date().toISOString(),
      note: `Driver ${driverId} accepted the order.`,
    });

    await this.emitOrderSignal(assignedOrder, "order.accepted", {
      driverId,
      trackingUrl: buildTrackingUrl(this.appBaseUrl, assignedOrder.trackingToken),
    });

    return this.getDriverDashboard(driverId);
  }

  async updateOrderStatus(
    driverId: string,
    orderId: string,
    update: OrderStatusUpdate,
  ) {
    const order = await this.repository.getOrder(orderId);

    if (order.assignedDriverId !== driverId) {
      throw new AppError(403, "DRIVER_NOT_ASSIGNED", "Only the assigned driver can update this order.");
    }

    if (!nextStatuses[order.status]?.includes(update.status)) {
      throw new AppError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Cannot move an order from ${order.status} to ${update.status}.`,
      );
    }

    const updatedOrder = await this.repository.updateOrderStatus(orderId, update.status);
    await this.repository.addOrderEvent({
      orderId,
      status: update.status,
      happenedAt: new Date().toISOString(),
      note: update.note,
    });

    await this.emitOrderSignal(updatedOrder, "order.status_changed", {
      driverId,
      status: update.status,
      note: update.note,
      trackingUrl: buildTrackingUrl(this.appBaseUrl, updatedOrder.trackingToken),
    });

    return {
      order: updatedOrder,
      tracking: await this.getTrackingByToken(updatedOrder.trackingToken),
      navigation: this.buildNavigation(updatedOrder),
    };
  }

  async expireOffer(orderId: string, driverId: string) {
    const order = await this.repository.getOrder(orderId);

    if (order.assignedDriverId) {
      return { ok: true, reason: "order_already_assigned" as const };
    }

    const offers = await this.repository.listOrderOffers(orderId);
    const targetedOffer = offers.find((offer) => offer.driverId === driverId);

    if (!targetedOffer || targetedOffer.status !== "pending") {
      return { ok: true, reason: "offer_not_pending" as const };
    }

    await this.repository.updateOfferStatus(orderId, driverId, "expired");
    await this.repository.addOrderEvent({
      orderId,
      status: order.status,
      happenedAt: new Date().toISOString(),
      note: `Offer for driver ${driverId} expired.`,
    });

    const remainingPending = (await this.repository.listOrderOffers(orderId)).filter(
      (offer) => offer.status === "pending",
    );

    if (!remainingPending.length) {
      const noDriverOrder = await this.repository.updateOrderStatus(
        orderId,
        "no_driver_found",
      );
      await this.repository.addOrderEvent({
        orderId,
        status: "no_driver_found",
        happenedAt: new Date().toISOString(),
        note: "All offer windows expired.",
      });
      await this.emitOrderSignal(noDriverOrder, "order.unassigned", {
        reason: "all_offers_expired",
      });
    }

    return { ok: true, reason: "offer_expired" as const };
  }

  async runCustomerWebhookJob(job: CustomerWebhookJobPayload) {
    await this.webhookService.deliver(
      job.targetUrl,
      job.event,
      job.orderId,
      job.payload,
    );

    return {
      ok: true,
    };
  }

  async getTrackingByToken(token: string): Promise<TrackingSnapshot> {
    const order = await this.repository.findOrderByTrackingToken(token);

    if (!order) {
      throw new AppError(404, "TRACKING_NOT_FOUND", "Tracking token was not found.");
    }

    const driver: Driver | null = order.assignedDriverId
      ? await this.repository.getDriver(order.assignedDriverId)
      : null;

    return {
      orderId: order.id,
      status: order.status,
      trackingUrl: buildTrackingUrl(this.appBaseUrl, token),
      pickup: order.pickup,
      dropoff: order.dropoff,
      driver: driver
        ? {
            id: driver.id,
            name: driver.name,
            vehicleLabel: driver.vehicleLabel,
            phoneNumber: driver.phoneNumber,
            point: driver.lastKnownLocation,
            updatedAt: driver.lastLocationAt,
          }
        : null,
      timeline: await this.repository.listOrderEvents(order.id),
      map: this.logisticsService.buildTaskMap(order, driver),
    };
  }

  async getOrder(orderId: string) {
    return this.repository.getOrder(orderId);
  }

  async getCustomerOrderView(
    orderId: string,
    customerUserId: string | null,
  ): Promise<CustomerOrderView> {
    const order = await this.repository.getOrder(orderId);
    const tracking = await this.getTrackingByToken(order.trackingToken);

    return {
      order: {
        ...order,
        customerUserId,
      },
      tracking,
      shareUrl: buildTrackingUrl(this.appBaseUrl, order.trackingToken),
    };
  }

  async getDriverRealtimeCredentials(driverId: string) {
    if (!this.saasignalService) {
      throw new AppError(
        503,
        "REALTIME_NOT_CONFIGURED",
        "SaaSignal realtime is not configured.",
      );
    }

    return this.saasignalService.createDriverRealtimeCredentials(driverId);
  }

  async getTrackingRealtimeCredentials(trackingToken: string) {
    if (!this.saasignalService) {
      throw new AppError(
        503,
        "REALTIME_NOT_CONFIGURED",
        "SaaSignal realtime is not configured.",
      );
    }

    const order = await this.repository.findOrderByTrackingToken(trackingToken);

    if (!order) {
      throw new AppError(404, "TRACKING_NOT_FOUND", "Tracking token was not found.");
    }

    return this.saasignalService.createTrackingRealtimeCredentials(trackingToken);
  }

  private async rankCandidates(order: Order) {
    const candidates = await this.repository.listCandidateDrivers();
    return this.logisticsService.rankDrivers(candidates as CandidateDriverRecord[], order);
  }

  private buildNavigation(order: Order): NavigationLinks {
    return {
      toPickup: buildGoogleMapsDirectionsUrl(order.pickup.point),
      toDropoff: buildGoogleMapsDirectionsUrl(order.dropoff.point),
    };
  }

  private async emitOrderSignal(
    order: Order,
    event: string,
    payload: Record<string, unknown>,
  ) {
    const enrichedPayload = {
      ...payload,
      orderId: order.id,
      trackingToken: order.trackingToken,
      status: order.status,
    };

    if (this.saasignalService) {
      await this.saasignalService
        .publishOrderEvent(order, event, enrichedPayload)
        .catch(() => undefined);

      if (order.customerWebhookUrl) {
        const queued = await this.saasignalService
          .queueCustomerWebhook({
            targetUrl: order.customerWebhookUrl,
            event,
            orderId: order.id,
            payload: enrichedPayload,
          })
          .then(() => true)
          .catch(() => false);

        if (!queued) {
          await this.webhookService.emit(order, event, enrichedPayload);
        }
      }
      return;
    }

    await this.webhookService.emit(order, event, enrichedPayload);
  }

  private async publishDriverEvent(
    driverId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    if (!this.saasignalService) {
      return;
    }

    await this.saasignalService
      .publishDriverEvent(driverId, event, payload)
      .catch(() => undefined);
  }
}
