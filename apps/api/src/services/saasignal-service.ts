import { SaaSignalClient } from "saasignal";
import type { DeliveryDriver, DeliveryDispatchSuggestion } from "saasignal";
import type {
  Coordinate,
  DispatchCandidate,
  Driver,
  DriverLocationUpdate,
  Offer,
  Order,
} from "@drops/contracts";
import { env } from "../lib/env.js";

type BrowserRealtimeCredentials = {
  channel: string;
  subscribeUrl: string;
  expiresAt: string;
};

type CustomerWebhookJobPayload = {
  event: string;
  orderId: string;
  targetUrl: string;
  payload: Record<string, unknown>;
};

type OfferExpiryJobPayload = {
  orderId: string;
  driverId: string;
};

export type SaaSignalRouteGeometry = {
  distanceKm: number | null;
  etaMinutes: number | null;
  points: Coordinate[];
  provider: "saasignal-logistics";
};

const trackingChannel = (trackingToken: string) => `tracking:${trackingToken}`;
const driverChannel = (driverId: string) => `drivers:${driverId}`;
const orderChannel = (orderId: string) => `orders:${orderId}`;

export class SaaSignalDispatchService {
  private readonly deliveryDriverIdsByAppId = new Map<string, string>();
  private readonly appDriverIdsByDeliveryId = new Map<string, string>();
  private readonly deliveryOrderIdsByAppOrderId = new Map<string, string>();

  constructor(private readonly client: SaaSignalClient) {}

  static fromEnv() {
    if (!env.saasignalApiKey) {
      return null;
    }

    return new SaaSignalDispatchService(
      new SaaSignalClient({
        apiKey: env.saasignalApiKey,
        baseUrl: env.saasignalApiUrl,
      }),
    );
  }

  async publishOrderEvent(
    order: Order,
    event: string,
    payload: Record<string, unknown>,
  ) {
    await Promise.allSettled([
      this.client.infra.channels.publish(orderChannel(order.id), event, payload),
      this.client.infra.channels.publish(
        trackingChannel(order.trackingToken),
        event,
        payload,
      ),
      order.assignedDriverId
        ? this.client.infra.channels.publish(
            driverChannel(order.assignedDriverId),
            event,
            payload,
          )
        : Promise.resolve(undefined),
    ]);
  }

  async publishDriverEvent(
    driverId: string,
    event: string,
    payload: Record<string, unknown>,
  ) {
    await this.client.infra.channels.publish(driverChannel(driverId), event, payload);
  }

  async trackDriver(driverId: string, location: DriverLocationUpdate) {
    await this.client.logistics.tracking.ping(driverId, {
      lat: location.point.latitude,
      lng: location.point.longitude,
      heading: location.heading,
      speed: location.speedKph,
      accuracy: location.accuracyMeters,
      recorded_at: new Date().toISOString(),
    });
  }

  async suggestDriversForOrder(
    order: Order,
    candidates: Driver[],
  ): Promise<DispatchCandidate[]> {
    const onlineDrivers = candidates.filter((driver) => driver.availability === "online");

    if (!onlineDrivers.length) {
      return [];
    }

    const syncedDrivers = await Promise.all(
      onlineDrivers.map(async (driver) => ({
        driver,
        deliveryDriverId: await this.syncDeliveryDriver(driver),
      })),
    );
    const deliveryOrderId = await this.syncDeliveryOrder(order);
    const suggestions = await this.client.delivery.dispatch.suggest({
      order_id: deliveryOrderId,
      limit: Math.max(3, syncedDrivers.length),
      radius_km: 30,
    });

    return suggestions
      .map((suggestion) => this.toDispatchCandidate(suggestion, syncedDrivers, order))
      .filter((candidate): candidate is DispatchCandidate => candidate !== null)
      .sort((left, right) => left.score - right.score);
  }

  async buildRoute(
    origin: Coordinate,
    destination: Coordinate,
    waypoints: Coordinate[] = [],
  ): Promise<SaaSignalRouteGeometry | null> {
    const raw = await this.client.logistics.routing.route(
      this.toLatLng(origin),
      this.toLatLng(destination),
      waypoints.map((point) => this.toLatLng(point)),
    );

    return this.normalizeRouteGeometry(raw, origin, destination);
  }

  async scheduleOfferExpiry(payload: OfferExpiryJobPayload, offer: Offer) {
    await this.client.infra.jobs.create({
      name: "expire-order-offer",
      trigger: {
        type: "delayed",
        delay_seconds: Math.max(
          1,
          Math.round(
            (new Date(offer.expiresAt).getTime() - Date.now()) / 1000,
          ),
        ),
      },
      handler: `${env.apiBaseUrl.replace(/\/$/, "")}/api/v1/internal/jobs/offers/expire?token=${encodeURIComponent(env.internalJobSecret)}`,
      payload,
      max_attempts: 3,
      backoff: "linear",
    });
  }

  async queueCustomerWebhook(job: CustomerWebhookJobPayload) {
    await this.client.infra.jobs.create({
      name: "deliver-customer-webhook",
      trigger: {
        type: "immediate",
      },
      handler: `${env.apiBaseUrl.replace(/\/$/, "")}/api/v1/internal/jobs/customer-webhook?token=${encodeURIComponent(env.internalJobSecret)}`,
      payload: job,
      max_attempts: 5,
      backoff: "exponential",
    });
  }

  async createDriverRealtimeCredentials(
    driverId: string,
  ): Promise<BrowserRealtimeCredentials> {
    const browserToken = await SaaSignalClient.createBrowserToken({
      apiKey: env.saasignalApiKey!,
      baseUrl: env.saasignalApiUrl,
      scopes: ["channels:subscribe"],
      ttl: 3600,
    });
    const browserClient = new SaaSignalClient({
      token: browserToken.token,
      baseUrl: env.saasignalApiUrl,
    });

    return {
      channel: driverChannel(driverId),
      subscribeUrl: browserClient.infra.channels.subscribeUrl(
        driverChannel(driverId),
      ),
      expiresAt: browserToken.expires_at,
    };
  }

  async createTrackingRealtimeCredentials(
    trackingTokenValue: string,
  ): Promise<BrowserRealtimeCredentials> {
    const browserToken = await SaaSignalClient.createBrowserToken({
      apiKey: env.saasignalApiKey!,
      baseUrl: env.saasignalApiUrl,
      scopes: ["channels:subscribe"],
      ttl: 3600,
    });
    const browserClient = new SaaSignalClient({
      token: browserToken.token,
      baseUrl: env.saasignalApiUrl,
    });

    return {
      channel: trackingChannel(trackingTokenValue),
      subscribeUrl: browserClient.infra.channels.subscribeUrl(
        trackingChannel(trackingTokenValue),
      ),
      expiresAt: browserToken.expires_at,
    };
  }

  private async syncDeliveryDriver(driver: Driver): Promise<string> {
    const cachedId = this.deliveryDriverIdsByAppId.get(driver.id);

    if (cachedId) {
      await this.syncDeliveryDriverStatus(cachedId, driver.availability);
      return cachedId;
    }

    const existing = await this.findDeliveryDriver(driver.id);

    if (existing) {
      this.rememberDriverMapping(driver.id, existing.id);
      await this.client.delivery.drivers.update(existing.id, {
        name: driver.name,
        phone: driver.phoneNumber,
        email: driver.email,
        metadata: this.toDriverMetadata(driver),
      });
      await this.syncDeliveryDriverStatus(existing.id, driver.availability);
      return existing.id;
    }

    const created = await this.client.delivery.drivers.create({
      name: driver.name,
      phone: driver.phoneNumber,
      email: driver.email,
      status: driver.availability,
      metadata: this.toDriverMetadata(driver),
    });

    this.rememberDriverMapping(driver.id, created.id);
    await this.syncDeliveryDriverStatus(created.id, driver.availability);
    return created.id;
  }

  private async syncDeliveryOrder(order: Order): Promise<string> {
    const cachedId = this.deliveryOrderIdsByAppOrderId.get(order.id);

    if (cachedId) {
      await this.client.delivery.orders.update(cachedId, {
        priority: this.toDeliveryPriority(order),
        pickup_address: order.pickup.addressLine,
        pickup_lat: order.pickup.point.latitude,
        pickup_lng: order.pickup.point.longitude,
        dropoff_address: order.dropoff.addressLine,
        dropoff_lat: order.dropoff.point.latitude,
        dropoff_lng: order.dropoff.point.longitude,
        metadata: this.toOrderMetadata(order),
      });
      return cachedId;
    }

    const created = await this.client.delivery.orders.create({
      external_id: order.id,
      priority: this.toDeliveryPriority(order),
      pickup_address: order.pickup.addressLine,
      pickup_lat: order.pickup.point.latitude,
      pickup_lng: order.pickup.point.longitude,
      dropoff_address: order.dropoff.addressLine,
      dropoff_lat: order.dropoff.point.latitude,
      dropoff_lng: order.dropoff.point.longitude,
      metadata: this.toOrderMetadata(order),
    });

    this.deliveryOrderIdsByAppOrderId.set(order.id, created.id);
    return created.id;
  }

  private async findDeliveryDriver(appDriverId: string): Promise<DeliveryDriver | null> {
    const result = await this.client.delivery.drivers.list({ limit: 100 });
    return (
      result.drivers.find((driver) => this.readAppDriverId(driver.metadata) === appDriverId) ??
      null
    );
  }

  private async syncDeliveryDriverStatus(
    deliveryDriverId: string,
    availability: Driver["availability"],
  ) {
    if (availability === "online") {
      await this.client.delivery.drivers.online(deliveryDriverId);
      return;
    }

    await this.client.delivery.drivers.offline(deliveryDriverId);
  }

  private toDispatchCandidate(
    suggestion: DeliveryDispatchSuggestion,
    syncedDrivers: Array<{ driver: Driver; deliveryDriverId: string }>,
    order: Order,
  ): DispatchCandidate | null {
    const appDriverId =
      this.appDriverIdsByDeliveryId.get(suggestion.entity_id) ??
      syncedDrivers.find((driver) => driver.deliveryDriverId === suggestion.entity_id)?.driver.id;

    if (!appDriverId) {
      return null;
    }

    const driver = syncedDrivers.find((entry) => entry.driver.id === appDriverId)?.driver;
    const distanceKm = Number(suggestion.distance_km.toFixed(2));
    const score = Number(
      (
        distanceKm +
        (driver?.activeOrderCount ?? 0) * 3.5 +
        (order.priority === "priority" ? -1.5 : 0)
      ).toFixed(2)
    );

    return {
      driverId: appDriverId,
      distanceKm,
      activeOrderCount: driver?.activeOrderCount ?? 0,
      score,
      rationale: `SaaSignal delivery suggest ranked ${driver?.name ?? suggestion.name} at ${distanceKm.toFixed(2)} km from pickup.`,
    };
  }

  private normalizeRouteGeometry(
    raw: unknown,
    origin: Coordinate,
    destination: Coordinate,
  ): SaaSignalRouteGeometry | null {
    const points = this.extractRoutePoints(raw);

    if (!points.length) {
      return null;
    }

    const normalizedPoints = this.ensureRouteEndpoints(points, origin, destination);

    return {
      provider: "saasignal-logistics",
      distanceKm: this.findNumericValue(raw, [
        "distance_km",
        "distanceKm",
        "distance",
      ]),
      etaMinutes: this.findNumericValue(raw, [
        "duration_min",
        "durationMin",
        "eta_minutes",
        "etaMinutes",
      ]),
      points: normalizedPoints,
    };
  }

  private extractRoutePoints(raw: unknown): Coordinate[] {
    if (!raw) {
      return [];
    }

    if (Array.isArray(raw)) {
      return this.mapCoordinateArray(raw);
    }

    if (typeof raw !== "object") {
      return [];
    }

    const value = raw as Record<string, unknown>;
    const direct = this.mapCoordinateArray(
      value.points ??
        value.coordinates ??
        value.path ??
        value.geometry ??
        value.route,
    );

    if (direct.length) {
      return direct;
    }

    if (Array.isArray(value.routes)) {
      for (const route of value.routes) {
        const nested = this.extractRoutePoints(route);
        if (nested.length) {
          return nested;
        }
      }
    }

    for (const nestedKey of ["route", "geometry", "trip", "result", "data"] as const) {
      const nested = this.extractRoutePoints(value[nestedKey]);
      if (nested.length) {
        return nested;
      }
    }

    return [];
  }

  private mapCoordinateArray(value: unknown): Coordinate[] {
    if (!Array.isArray(value)) {
      if (value && typeof value === "object" && "coordinates" in (value as Record<string, unknown>)) {
        return this.mapCoordinateArray((value as { coordinates?: unknown }).coordinates);
      }

      return [];
    }

    return value
      .map((entry) => this.toCoordinate(entry))
      .filter((entry): entry is Coordinate => entry !== null);
  }

  private toCoordinate(value: unknown): Coordinate | null {
    if (!value) {
      return null;
    }

    if (Array.isArray(value) && value.length >= 2) {
      const [first, second] = value;
      if (typeof first !== "number" || typeof second !== "number") {
        return null;
      }

      // GeoJSON arrays are [lng, lat].
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
        return { latitude: second, longitude: first };
      }

      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
        return { latitude: first, longitude: second };
      }

      return null;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const latitude = this.readNumber(record.latitude) ?? this.readNumber(record.lat);
      const longitude = this.readNumber(record.longitude) ?? this.readNumber(record.lng);

      if (latitude !== null && longitude !== null) {
        return { latitude, longitude };
      }
    }

    return null;
  }

  private ensureRouteEndpoints(
    points: Coordinate[],
    origin: Coordinate,
    destination: Coordinate,
  ) {
    const withOrigin =
      points[0] &&
      points[0].latitude === origin.latitude &&
      points[0].longitude === origin.longitude
        ? points
        : [origin, ...points];

    const last = withOrigin[withOrigin.length - 1];

    return last &&
      last.latitude === destination.latitude &&
      last.longitude === destination.longitude
      ? withOrigin
      : [...withOrigin, destination];
  }

  private findNumericValue(raw: unknown, keys: string[]): number | null {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const record = raw as Record<string, unknown>;

    for (const key of keys) {
      const direct = this.readNumber(record[key]);
      if (direct !== null) {
        return direct;
      }
    }

    for (const nestedKey of ["summary", "route", "result", "data"] as const) {
      const nested = this.findNumericValue(record[nestedKey], keys);
      if (nested !== null) {
        return nested;
      }
    }

    if (keys.includes("duration_min")) {
      const seconds = this.findNumericValue(raw, ["duration_sec", "duration_seconds"]);
      if (seconds !== null) {
        return Number((seconds / 60).toFixed(1));
      }
    }

    return null;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private toLatLng(point: Coordinate) {
    return {
      lat: point.latitude,
      lng: point.longitude,
    };
  }

  private toDeliveryPriority(order: Order) {
    return order.priority === "priority" ? 90 : 50;
  }

  private toDriverMetadata(driver: Driver) {
    return {
      appDriverId: driver.id,
      vehicleLabel: driver.vehicleLabel,
    };
  }

  private toOrderMetadata(order: Order) {
    return {
      appOrderId: order.id,
      trackingToken: order.trackingToken,
      customerName: order.customerName,
    };
  }

  private readAppDriverId(metadata: unknown) {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    const appDriverId = (metadata as { appDriverId?: unknown }).appDriverId;
    return typeof appDriverId === "string" ? appDriverId : null;
  }

  private rememberDriverMapping(appDriverId: string, deliveryDriverId: string) {
    this.deliveryDriverIdsByAppId.set(appDriverId, deliveryDriverId);
    this.appDriverIdsByDeliveryId.set(deliveryDriverId, appDriverId);
  }
}
