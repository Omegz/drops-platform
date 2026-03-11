import { SaaSignalClient } from "saasignal";
import type { DeliveryDriver, DeliveryDispatchSuggestion } from "saasignal";
import type {
  Coordinate,
  DispatchCandidate,
  Driver,
  DriverLocationUpdate,
  LogisticsPlace,
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

type SaaSignalGeoEntity = {
  id: string;
  externalId: string | null;
  type: string;
  name: string;
  status: string | null;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string | null;
  metadata: unknown;
};

type SaaSignalRoutingCell = {
  distanceKm: number | null;
  durationMin: number | null;
  googleMapsUrl: string | null;
};

type SaaSignalRoutingAssignment = {
  agentId: string;
  taskId: string;
  distanceKm: number | null;
  durationMin: number | null;
  googleMapsUrl: string | null;
};

const trackingChannel = (trackingToken: string) => `tracking:${trackingToken}`;
const driverChannel = (driverId: string) => `drivers:${driverId}`;
const orderChannel = (orderId: string) => `orders:${orderId}`;

export class SaaSignalDispatchService {
  private readonly deliveryDriverIdsByAppId = new Map<string, string>();
  private readonly appDriverIdsByDeliveryId = new Map<string, string>();
  private readonly deliveryOrderIdsByAppOrderId = new Map<string, string>();
  private readonly geoEntityIdsByAppDriverId = new Map<string, string>();
  private readonly geoEntityIdsByExternalId = new Map<string, string>();

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

  async trackDriver(driver: Driver, location: DriverLocationUpdate) {
    const geoEntityId = await this.ensureDriverGeoEntity({
      ...driver,
      lastKnownLocation: location.point,
      lastLocationAt: new Date().toISOString(),
    });

    await this.client.logistics.tracking.ping(geoEntityId, {
      lat: location.point.latitude,
      lng: location.point.longitude,
      heading: location.heading,
      speed: location.speedKph,
      accuracy: location.accuracyMeters,
      recorded_at: new Date().toISOString(),
    });
  }

  async syncDriverState(driver: Driver) {
    await Promise.allSettled([
      this.syncDeliveryDriver(driver),
      this.ensureDriverGeoEntity(driver),
    ]);
  }

  async searchPlaces(
    query: string,
    options: {
      limit?: number;
      proximity?: Coordinate;
      country?: string;
      language?: string;
    } = {},
  ): Promise<LogisticsPlace[]> {
    const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const [autocompleteResult, geoEntityResult] = await Promise.allSettled([
      this.client.logistics.geocoding.autocomplete(normalizedQuery, {
        limit,
        country: options.country,
        language: options.language,
        proximity: options.proximity
          ? this.toLatLng(options.proximity)
          : undefined,
      }),
      this.client.logistics.geo.list({
        limit: 100,
      }),
    ]);

    const places = new Map<string, LogisticsPlace>();

    if (autocompleteResult.status === "fulfilled") {
      for (const place of this.normalizeGeocodingPlaces(autocompleteResult.value)) {
        places.set(this.placeKey(place), place);
      }
    }

    if (geoEntityResult.status === "fulfilled") {
      for (const place of this.filterGeoEntityPlaces(
        this.normalizeGeoEntities(geoEntityResult.value)
          .filter((entity) => entity.type !== "driver")
          .map((entity) => this.toGeoEntityPlace(entity))
          .filter((entry): entry is LogisticsPlace => entry !== null),
        normalizedQuery,
      )) {
        places.set(this.placeKey(place), place);
      }
    }

    return Array.from(places.values()).slice(0, limit);
  }

  async syncOrderState(order: Order) {
    await Promise.allSettled([
      this.syncDeliveryOrder(order),
      this.syncOrderGeoEntities(order),
    ]);
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
    await this.syncOrderGeoEntities(order);

    const routedCandidates = await this.rankDriversWithRouting(order, syncedDrivers);
    if (routedCandidates.length) {
      return routedCandidates;
    }

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
      this.rememberDriverMapping(driver.id, existing.id, existing.geo_entity_id);
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

    this.rememberDriverMapping(driver.id, created.id, created.geo_entity_id);
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

  private async syncOrderGeoEntities(order: Order) {
    const midpoint = {
      latitude: (order.pickup.point.latitude + order.dropoff.point.latitude) / 2,
      longitude: (order.pickup.point.longitude + order.dropoff.point.longitude) / 2,
    };

    await Promise.allSettled([
      this.ensureGeoEntity({
        externalId: `order:${order.id}`,
        type: "order",
        name: `Order ${order.id}`,
        status: order.status,
        point: midpoint,
        metadata: this.toOrderMetadata(order),
      }),
      this.ensureGeoEntity({
        externalId: `order:${order.id}:pickup`,
        type: "pickup",
        name: order.pickup.addressLine,
        status: order.status,
        point: order.pickup.point,
        metadata: {
          ...this.toOrderMetadata(order),
          stopKind: "pickup",
        },
      }),
      this.ensureGeoEntity({
        externalId: `order:${order.id}:dropoff`,
        type: "dropoff",
        name: order.dropoff.addressLine,
        status: order.status,
        point: order.dropoff.point,
        metadata: {
          ...this.toOrderMetadata(order),
          stopKind: "dropoff",
        },
      }),
    ]);
  }

  private async ensureDriverGeoEntity(driver: Driver) {
    await this.syncDeliveryDriver(driver);

    return this.ensureGeoEntity(
      {
        externalId: `driver:${driver.id}`,
        type: "driver",
        name: driver.name,
        status: driver.availability,
        point: driver.lastKnownLocation ?? undefined,
        metadata: this.toDriverMetadata(driver),
      },
      driver.id,
    );
  }

  private async ensureGeoEntity(
    input: {
      externalId: string;
      type: string;
      name: string;
      status?: string;
      point?: Coordinate;
      metadata?: unknown;
    },
    appDriverId?: string,
  ) {
    const cachedId =
      (appDriverId ? this.geoEntityIdsByAppDriverId.get(appDriverId) : null) ??
      this.geoEntityIdsByExternalId.get(input.externalId);
    const updateBody = {
      name: input.name,
      external_id: input.externalId,
      type: input.type,
      status: input.status,
      lat: input.point?.latitude,
      lng: input.point?.longitude,
      metadata: input.metadata,
    };

    if (cachedId) {
      await this.client.logistics.geo.update(cachedId, updateBody);
      this.rememberGeoEntity(input.externalId, cachedId, appDriverId);
      return cachedId;
    }

    const existing = await this.findGeoEntityByExternalId(input.externalId, input.type);

    if (existing) {
      await this.client.logistics.geo.update(existing.id, updateBody);
      this.rememberGeoEntity(input.externalId, existing.id, appDriverId);
      return existing.id;
    }

    const created = this.toGeoEntity(
      await this.client.logistics.geo.create({
        type: input.type,
        name: input.name,
        external_id: input.externalId,
        status: input.status,
        lat: input.point?.latitude,
        lng: input.point?.longitude,
        metadata: input.metadata,
      }),
    );

    if (!created) {
      throw new Error("SaaSignal geo entity create returned an unexpected payload.");
    }

    this.rememberGeoEntity(input.externalId, created.id, appDriverId);
    return created.id;
  }

  private async findGeoEntityByExternalId(
    externalId: string,
    type?: string,
  ): Promise<SaaSignalGeoEntity | null> {
    let cursor: string | undefined;

    for (let page = 0; page < 5; page += 1) {
      const raw = await this.client.logistics.geo.list({
        type,
        limit: 100,
        cursor,
      });
      const entities = this.normalizeGeoEntities(raw);
      const match = entities.find((entity) => entity.externalId === externalId);

      if (match) {
        return match;
      }

      const nextCursor =
        raw && typeof raw === "object"
          ? this.readString((raw as Record<string, unknown>).next_cursor)
          : null;

      if (!nextCursor) {
        break;
      }

      cursor = nextCursor;
    }

    return null;
  }

  private async rankDriversWithRouting(
    order: Order,
    syncedDrivers: Array<{ driver: Driver; deliveryDriverId: string }>,
  ): Promise<DispatchCandidate[]> {
    const locatedDrivers = syncedDrivers.filter(
      (entry): entry is { driver: Driver & { lastKnownLocation: Coordinate }; deliveryDriverId: string } =>
        entry.driver.lastKnownLocation !== null,
    );

    if (!locatedDrivers.length) {
      return [];
    }

    const rawMatrix = await this.client.logistics.routing.distanceMatrix(
      locatedDrivers.map((entry) => this.toLatLng(entry.driver.lastKnownLocation)),
      [this.toLatLng(order.pickup.point)],
    );
    const matrix = this.normalizeDistanceMatrix(rawMatrix);

    if (!matrix.length) {
      return [];
    }

    const preferredAgentId = await this.findTopRoutingAssignment(order, locatedDrivers);

    return locatedDrivers
      .map((entry, index) => {
        const cell = matrix[index]?.[0];

        if (!cell || cell.distanceKm === null) {
          return null;
        }

        const durationMin =
          cell.durationMin ?? Number(((cell.distanceKm / 0.42) * 10).toFixed(1));
        const score = Number(
          (
            durationMin +
            entry.driver.activeOrderCount * 3.5 +
            (order.priority === "priority" ? -1.5 : 0)
          ).toFixed(2),
        );

        return {
          driverId: entry.driver.id,
          distanceKm: Number(cell.distanceKm.toFixed(2)),
          activeOrderCount: entry.driver.activeOrderCount,
          score,
          rationale:
            `SaaSignal routing matrix estimated ${durationMin.toFixed(1)} min to pickup.` +
            (preferredAgentId === entry.driver.id
              ? " Routing dispatch selected this driver for the task."
              : ""),
        } satisfies DispatchCandidate;
      })
      .filter((candidate): candidate is DispatchCandidate => candidate !== null)
      .sort((left, right) => left.score - right.score);
  }

  private async findTopRoutingAssignment(
    order: Order,
    syncedDrivers: Array<{ driver: Driver & { lastKnownLocation: Coordinate }; deliveryDriverId: string }>,
  ) {
    const raw = await this.client.logistics.routing.dispatch(
      syncedDrivers.map((entry) => ({
        id: entry.driver.id,
        lat: entry.driver.lastKnownLocation.latitude,
        lng: entry.driver.lastKnownLocation.longitude,
      })),
      [
        {
          id: order.id,
          lat: order.pickup.point.latitude,
          lng: order.pickup.point.longitude,
        },
      ],
    );

    return (
      this.normalizeRoutingAssignments(raw).find(
        (assignment) => assignment.taskId === order.id,
      )?.agentId ?? null
    );
  }

  private normalizeDistanceMatrix(raw: unknown): SaaSignalRoutingCell[][] {
    if (!raw || typeof raw !== "object") {
      return [];
    }

    const matrix = (raw as { matrix?: unknown }).matrix;
    if (!Array.isArray(matrix)) {
      return [];
    }

    return matrix.map((row) =>
      Array.isArray(row)
        ? row.map((cell) => ({
            distanceKm: this.findNumericValue(cell, ["distance_km", "distanceKm"]),
            durationMin: this.findNumericValue(cell, ["duration_min", "durationMin"]),
            googleMapsUrl:
              cell && typeof cell === "object"
                ? this.readString((cell as Record<string, unknown>).google_maps_url)
                : null,
          }))
        : [],
    );
  }

  private normalizeRoutingAssignments(raw: unknown): SaaSignalRoutingAssignment[] {
    if (!raw || typeof raw !== "object") {
      return [];
    }

    const assignments = (raw as { assignments?: unknown }).assignments;
    if (!Array.isArray(assignments)) {
      return [];
    }

    return assignments
      .map((assignment) => {
        if (!assignment || typeof assignment !== "object") {
          return null;
        }

        const record = assignment as Record<string, unknown>;
        const agentId = this.readString(record.agent_id);
        const taskId = this.readString(record.task_id);

        if (!agentId || !taskId) {
          return null;
        }

        return {
          agentId,
          taskId,
          distanceKm: this.findNumericValue(record, ["distance_km", "distanceKm"]),
          durationMin: this.findNumericValue(record, ["duration_min", "durationMin"]),
          googleMapsUrl: this.readString(record.google_maps_url),
        } satisfies SaaSignalRoutingAssignment;
      })
      .filter((assignment): assignment is SaaSignalRoutingAssignment => assignment !== null);
  }

  private normalizeGeocodingPlaces(raw: unknown): LogisticsPlace[] {
    if (!raw || typeof raw !== "object") {
      return [];
    }

    const suggestions =
      (raw as { suggestions?: unknown; results?: unknown }).suggestions ??
      (raw as { results?: unknown }).results;

    if (!Array.isArray(suggestions)) {
      return [];
    }

    return suggestions
      .map<LogisticsPlace | null>((entry, index) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const latitude =
          this.readNumber(record.lat) ?? this.readNumber(record.latitude);
        const longitude =
          this.readNumber(record.lng) ?? this.readNumber(record.longitude);
        const label =
          this.readString(record.place_name) ??
          this.readString(record.name) ??
          this.readString(record.address);
        const addressLine =
          this.readString(record.address) ??
          this.readString(record.place_name) ??
          label;

        if (latitude === null || longitude === null || !label || !addressLine) {
          return null;
        }

        return {
          id: `geocode-${index}-${latitude}-${longitude}`,
          label,
          addressLine,
          point: {
            latitude,
            longitude,
          },
          source: "saasignal-geocoding",
          kind: "address",
          googleMapsUrl: this.readString(record.google_maps_url) ?? undefined,
        } satisfies LogisticsPlace;
      })
      .filter((place): place is LogisticsPlace => place !== null);
  }

  private normalizeGeoEntities(raw: unknown): SaaSignalGeoEntity[] {
    if (!raw || typeof raw !== "object") {
      return [];
    }

    const entities = (raw as { entities?: unknown }).entities;
    if (!Array.isArray(entities)) {
      return [];
    }

    return entities
      .map((entity) => this.toGeoEntity(entity))
      .filter((entity): entity is SaaSignalGeoEntity => entity !== null);
  }

  private toGeoEntity(value: unknown): SaaSignalGeoEntity | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const id = this.readString(record.id);
    const type = this.readString(record.type);
    const name = this.readString(record.name);

    if (!id || !type || !name) {
      return null;
    }

    return {
      id,
      externalId: this.readString(record.external_id),
      type,
      name,
      status: this.readString(record.status),
      lat: this.readNumber(record.lat),
      lng: this.readNumber(record.lng),
      googleMapsUrl: this.readString(record.google_maps_url),
      metadata: record.metadata ?? null,
    };
  }

  private toGeoEntityPlace(entity: SaaSignalGeoEntity): LogisticsPlace | null {
    if (entity.lat === null || entity.lng === null) {
      return null;
    }

    return {
      id: entity.id,
      label: entity.name,
      addressLine: entity.name,
      point: {
        latitude: entity.lat,
        longitude: entity.lng,
      },
      source: "saasignal-geo-entity",
      kind: "geo_entity",
      entityType: entity.type,
      externalId: entity.externalId ?? undefined,
      googleMapsUrl: entity.googleMapsUrl ?? undefined,
    };
  }

  private filterGeoEntityPlaces(places: LogisticsPlace[], query: string) {
    const normalizedQuery = query.trim().toLowerCase();

    return places
      .filter((place) =>
        [place.label, place.addressLine, place.entityType, place.externalId]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .sort((left, right) => this.placeMatchScore(right, normalizedQuery) - this.placeMatchScore(left, normalizedQuery));
  }

  private placeMatchScore(place: LogisticsPlace, query: string) {
    const haystack = `${place.label} ${place.addressLine} ${place.entityType ?? ""} ${
      place.externalId ?? ""
    }`.toLowerCase();

    if (haystack === query) {
      return 3;
    }

    if (haystack.startsWith(query)) {
      return 2;
    }

    if (haystack.includes(query)) {
      return 1;
    }

    return 0;
  }

  private placeKey(place: LogisticsPlace) {
    return `${place.kind}:${place.label}:${place.point.latitude.toFixed(5)}:${place.point.longitude.toFixed(5)}`;
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

  private readString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
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

  private rememberGeoEntity(
    externalId: string,
    geoEntityId: string,
    appDriverId?: string,
  ) {
    this.geoEntityIdsByExternalId.set(externalId, geoEntityId);

    if (appDriverId) {
      this.geoEntityIdsByAppDriverId.set(appDriverId, geoEntityId);
    }
  }

  private rememberDriverMapping(
    appDriverId: string,
    deliveryDriverId: string,
    geoEntityId?: string | null,
  ) {
    this.deliveryDriverIdsByAppId.set(appDriverId, deliveryDriverId);
    this.appDriverIdsByDeliveryId.set(deliveryDriverId, appDriverId);

    if (geoEntityId) {
      this.geoEntityIdsByAppDriverId.set(appDriverId, geoEntityId);
      this.geoEntityIdsByExternalId.set(`driver:${appDriverId}`, geoEntityId);
    }
  }
}
