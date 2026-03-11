import type {
  CreateOrderInput,
  Driver,
  DriverAvailability,
  DriverDeviceRegistration,
  DriverLocationUpdate,
  Offer,
  OfferStatus,
  Order,
  OrderEvent,
  OrderStatus,
} from "@drops/contracts";
import { CloudflareD1Client } from "../db/d1-client.js";
import { AppError } from "../lib/http-error.js";
import { createId } from "../lib/id.js";

type DriverRecord = Driver & {
  devices: DriverDeviceRegistration[];
};

type DriverRow = {
  id: string;
  name: string;
  phone_number: string | null;
  vehicle_label: string;
  availability: DriverAvailability;
  last_known_latitude: number | null;
  last_known_longitude: number | null;
  last_location_at: string | null;
  active_order_count?: number;
  created_at?: string;
  updated_at?: string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone_number: string | null;
  pickup_json: string;
  dropoff_json: string;
  notes: string | null;
  priority: "normal" | "priority";
  status: OrderStatus;
  assigned_driver_id: string | null;
  tracking_token: string;
  customer_webhook_url: string | null;
  created_at: string;
  updated_at: string;
};

type OfferRow = {
  id: string;
  order_id: string;
  driver_id: string;
  status: OfferStatus;
  score: number;
  pickup_distance_km: number;
  pickup_json: string;
  dropoff_json: string;
  offered_at: string;
  expires_at: string;
};

type EventRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  happened_at: string;
};

type DeviceRow = {
  id: string;
  driver_id: string;
  platform: "expo" | "web";
  expo_push_token: string | null;
  endpoint: string | null;
  subscription_json: string | null;
};

export type CandidateDriverRecord = DriverRecord;

const nowIso = () => new Date().toISOString();

const activeOrderStatuses = new Set<OrderStatus>([
  "accepted",
  "on_the_way",
  "picked_up",
]);

const seededDrivers: DriverRecord[] = [
  {
    id: "driver_demo_01",
    name: "Mikael Jensen",
    phoneNumber: "+45 12 34 56 78",
    vehicleLabel: "Van 12",
    availability: "online",
    activeOrderCount: 0,
    lastKnownLocation: {
      latitude: 55.6761,
      longitude: 12.5683,
    },
    lastLocationAt: nowIso(),
    devices: [],
  },
  {
    id: "driver_demo_02",
    name: "Sara Nielsen",
    phoneNumber: "+45 21 43 65 87",
    vehicleLabel: "Bike 4",
    availability: "online",
    activeOrderCount: 0,
    lastKnownLocation: {
      latitude: 55.6852,
      longitude: 12.5736,
    },
    lastLocationAt: nowIso(),
    devices: [],
  },
  {
    id: "driver_demo_03",
    name: "Jonas Holm",
    phoneNumber: "+45 98 76 54 32",
    vehicleLabel: "Car 9",
    availability: "offline",
    activeOrderCount: 0,
    lastKnownLocation: {
      latitude: 55.6725,
      longitude: 12.5551,
    },
    lastLocationAt: nowIso(),
    devices: [],
  },
];

export interface DispatchRepository {
  listDrivers(): Promise<Driver[]>;
  getDriver(driverId: string): Promise<DriverRecord>;
  setDriverAvailability(
    driverId: string,
    availability: DriverAvailability,
  ): Promise<Driver>;
  updateDriverLocation(
    driverId: string,
    location: DriverLocationUpdate,
  ): Promise<Driver>;
  registerDriverDevice(
    driverId: string,
    registration: DriverDeviceRegistration,
  ): Promise<void>;
  listCandidateDrivers(): Promise<CandidateDriverRecord[]>;
  createOrder(input: CreateOrderInput, trackingToken: string): Promise<Order>;
  getOrder(orderId: string): Promise<Order>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order>;
  assignOrder(orderId: string, driverId: string): Promise<Order>;
  listDriverOffers(driverId: string): Promise<Offer[]>;
  listOrderOffers(orderId: string): Promise<Offer[]>;
  saveOffers(orderId: string, offers: Offer[]): Promise<void>;
  updateOfferStatus(
    orderId: string,
    driverId: string,
    status: OfferStatus,
  ): Promise<void>;
  addOrderEvent(event: OrderEvent): Promise<void>;
  listOrderEvents(orderId: string): Promise<OrderEvent[]>;
  findOrderByTrackingToken(token: string): Promise<Order | null>;
  getDriverDevices(driverId: string): Promise<DriverDeviceRegistration[]>;
  getDriverActiveOrder(driverId: string): Promise<Order | null>;
}

const toDriver = (row: DriverRow, devices: DriverDeviceRegistration[] = []): DriverRecord => ({
  id: row.id,
  name: row.name,
  phoneNumber: row.phone_number ?? undefined,
  vehicleLabel: row.vehicle_label,
  availability: row.availability,
  activeOrderCount: Number(row.active_order_count ?? 0),
  lastKnownLocation:
    row.last_known_latitude !== null && row.last_known_longitude !== null
      ? {
          latitude: row.last_known_latitude,
          longitude: row.last_known_longitude,
        }
      : null,
  lastLocationAt: row.last_location_at,
  devices,
});

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhoneNumber: row.customer_phone_number ?? undefined,
  pickup: JSON.parse(row.pickup_json),
  dropoff: JSON.parse(row.dropoff_json),
  notes: row.notes ?? undefined,
  priority: row.priority,
  status: row.status,
  assignedDriverId: row.assigned_driver_id,
  trackingToken: row.tracking_token,
  customerWebhookUrl: row.customer_webhook_url ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toOffer = (row: OfferRow): Offer => ({
  orderId: row.order_id,
  driverId: row.driver_id,
  status: row.status,
  score: Number(row.score),
  pickupDistanceKm: Number(row.pickup_distance_km),
  pickup: JSON.parse(row.pickup_json),
  dropoff: JSON.parse(row.dropoff_json),
  offeredAt: row.offered_at,
  expiresAt: row.expires_at,
});

const toEvent = (row: EventRow): OrderEvent => ({
  orderId: row.order_id,
  status: row.status,
  note: row.note ?? undefined,
  happenedAt: row.happened_at,
});

const toDevice = (row: DeviceRow): DriverDeviceRegistration => {
  if (row.platform === "expo") {
    return {
      platform: "expo",
      expoPushToken: row.expo_push_token ?? "",
    };
  }

  const parsed =
    row.subscription_json !== null
      ? (JSON.parse(row.subscription_json) as DriverDeviceRegistration)
      : null;

  return (
    parsed ?? {
      platform: "web",
      endpoint: row.endpoint ?? "",
      keys: {
        auth: "",
        p256dh: "",
      },
    }
  );
};

export class InMemoryDispatchRepository implements DispatchRepository {
  private readonly drivers = new Map<string, DriverRecord>();
  private readonly orders = new Map<string, Order>();
  private readonly offersByOrder = new Map<string, Offer[]>();
  private readonly eventsByOrder = new Map<string, OrderEvent[]>();

  constructor() {
    seededDrivers.forEach((driver) => {
      this.drivers.set(driver.id, driver);
    });
  }

  async listDrivers() {
    return Array.from(this.drivers.values()).map(({ devices: _devices, ...driver }) => ({
      ...driver,
      activeOrderCount: this.countActiveOrders(driver.id),
    }));
  }

  async getDriver(driverId: string) {
    const driver = this.drivers.get(driverId);

    if (driver) {
      return {
        ...driver,
        activeOrderCount: this.countActiveOrders(driverId),
      };
    }

    const created: DriverRecord = {
      id: driverId,
      name: `Driver ${driverId.slice(-4)}`,
      vehicleLabel: "Unassigned vehicle",
      availability: "offline",
      activeOrderCount: 0,
      lastKnownLocation: null,
      lastLocationAt: null,
      devices: [],
    };

    this.drivers.set(driverId, created);
    return created;
  }

  async setDriverAvailability(driverId: string, availability: DriverAvailability) {
    const driver = await this.getDriver(driverId);
    const updated: DriverRecord = {
      ...driver,
      availability,
    };

    this.drivers.set(driverId, updated);
    return this.withComputedOrderCount(updated);
  }

  async updateDriverLocation(driverId: string, location: DriverLocationUpdate) {
    const driver = await this.getDriver(driverId);
    const updated: DriverRecord = {
      ...driver,
      lastKnownLocation: location.point,
      lastLocationAt: nowIso(),
    };

    this.drivers.set(driverId, updated);
    return this.withComputedOrderCount(updated);
  }

  async registerDriverDevice(
    driverId: string,
    registration: DriverDeviceRegistration,
  ) {
    const driver = await this.getDriver(driverId);
    const existing = driver.devices.filter((device) => {
      if (device.platform !== registration.platform) {
        return true;
      }

      if (registration.platform === "expo" && device.platform === "expo") {
        return device.expoPushToken !== registration.expoPushToken;
      }

      if (registration.platform === "web" && device.platform === "web") {
        return device.endpoint !== registration.endpoint;
      }

      return true;
    });

    this.drivers.set(driverId, {
      ...driver,
      devices: [...existing, registration],
    });
  }

  async listCandidateDrivers() {
    const drivers = await this.listDrivers();

    return drivers
      .map((driver) => ({
        ...this.drivers.get(driver.id)!,
        activeOrderCount: this.countActiveOrders(driver.id),
      }))
      .filter((driver) => driver.availability === "online");
  }

  async createOrder(input: CreateOrderInput, trackingToken: string) {
    const timestamp = nowIso();
    const order: Order = {
      id: createId("ord"),
      customerName: input.customerName,
      customerPhoneNumber: input.customerPhoneNumber,
      pickup: input.pickup,
      dropoff: input.dropoff,
      notes: input.notes,
      priority: input.priority,
      status: "pending_assignment",
      assignedDriverId: null,
      trackingToken,
      createdAt: timestamp,
      updatedAt: timestamp,
      customerWebhookUrl: input.customerWebhookUrl,
    };

    this.orders.set(order.id, order);
    await this.addOrderEvent({
      orderId: order.id,
      status: order.status,
      happenedAt: timestamp,
      note: "Order created and queued for allocation.",
    });
    return order;
  }

  async getOrder(orderId: string) {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new AppError(404, "ORDER_NOT_FOUND", `Order ${orderId} was not found.`);
    }

    return order;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = await this.getOrder(orderId);
    const updated: Order = {
      ...order,
      status,
      updatedAt: nowIso(),
    };

    this.orders.set(orderId, updated);
    return updated;
  }

  async assignOrder(orderId: string, driverId: string) {
    const order = await this.getOrder(orderId);
    const updated: Order = {
      ...order,
      assignedDriverId: driverId,
      status: "accepted",
      updatedAt: nowIso(),
    };

    this.orders.set(orderId, updated);
    return updated;
  }

  async listDriverOffers(driverId: string) {
    this.expireOffers();

    return Array.from(this.offersByOrder.values())
      .flat()
      .filter((offer) => offer.driverId === driverId && offer.status === "pending");
  }

  async listOrderOffers(orderId: string) {
    this.expireOffers(orderId);
    return this.offersByOrder.get(orderId) ?? [];
  }

  async saveOffers(orderId: string, offers: Offer[]) {
    this.offersByOrder.set(orderId, offers);
    await this.updateOrderStatus(orderId, offers.length ? "offer_sent" : "no_driver_found");
  }

  async updateOfferStatus(orderId: string, driverId: string, status: OfferStatus) {
    const offers = await this.listOrderOffers(orderId);
    this.offersByOrder.set(
      orderId,
      offers.map((offer) =>
        offer.driverId === driverId ? { ...offer, status } : offer,
      ),
    );
  }

  async addOrderEvent(event: OrderEvent) {
    const nextEvents = [...(this.eventsByOrder.get(event.orderId) ?? []), event];
    this.eventsByOrder.set(event.orderId, nextEvents);
  }

  async listOrderEvents(orderId: string) {
    return this.eventsByOrder.get(orderId) ?? [];
  }

  async findOrderByTrackingToken(token: string) {
    return (
      Array.from(this.orders.values()).find((order) => order.trackingToken === token) ??
      null
    );
  }

  async getDriverDevices(driverId: string) {
    return (await this.getDriver(driverId)).devices;
  }

  async getDriverActiveOrder(driverId: string) {
    return (
      Array.from(this.orders.values()).find(
        (order) =>
          order.assignedDriverId === driverId &&
          activeOrderStatuses.has(order.status),
      ) ?? null
    );
  }

  private withComputedOrderCount(driver: DriverRecord): Driver {
    return {
      ...driver,
      activeOrderCount: this.countActiveOrders(driver.id),
    };
  }

  private countActiveOrders(driverId: string) {
    return Array.from(this.orders.values()).filter(
      (order) =>
        order.assignedDriverId === driverId &&
        activeOrderStatuses.has(order.status),
    ).length;
  }

  private expireOffers(orderId?: string) {
    const now = new Date();
    const targetEntries = orderId
      ? [[orderId, this.offersByOrder.get(orderId) ?? []] as const]
      : Array.from(this.offersByOrder.entries());

    targetEntries.forEach(([currentOrderId, offers]) => {
      const nextOffers = offers.map((offer) =>
        offer.status === "pending" && new Date(offer.expiresAt) < now
          ? { ...offer, status: "expired" as const }
          : offer,
      );

      this.offersByOrder.set(currentOrderId, nextOffers);
    });
  }
}

export class D1DispatchRepository implements DispatchRepository {
  constructor(private readonly d1: CloudflareD1Client) {}

  async listDrivers() {
    const rows = await this.d1.queryMany<DriverRow>(`
      SELECT
        d.*,
        COALESCE((
          SELECT COUNT(*) FROM orders o
          WHERE o.assigned_driver_id = d.id
            AND o.status IN ('accepted', 'on_the_way', 'picked_up')
        ), 0) AS active_order_count
      FROM drivers d
      ORDER BY d.name ASC
    `);

    return rows.map((row) => toDriver(row));
  }

  async getDriver(driverId: string) {
    let row = await this.d1.queryOne<DriverRow>(
      `
        SELECT
          d.*,
          COALESCE((
            SELECT COUNT(*) FROM orders o
            WHERE o.assigned_driver_id = d.id
              AND o.status IN ('accepted', 'on_the_way', 'picked_up')
          ), 0) AS active_order_count
        FROM drivers d
        WHERE d.id = ?
      `,
      [driverId],
    );

    if (!row) {
      const timestamp = nowIso();
      await this.d1.execute(
        `
          INSERT INTO drivers (
            id, name, vehicle_label, availability, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          driverId,
          `Driver ${driverId.slice(-4)}`,
          "Unassigned vehicle",
          "offline",
          timestamp,
          timestamp,
        ],
      );

      row = await this.d1.queryOne<DriverRow>(
        `
          SELECT
            d.*,
            0 AS active_order_count
          FROM drivers d
          WHERE d.id = ?
        `,
        [driverId],
      );
    }

    if (!row) {
      throw new AppError(500, "DRIVER_LOOKUP_FAILED", "Driver could not be loaded.");
    }

    return toDriver(row, await this.getDriverDevices(driverId));
  }

  async setDriverAvailability(driverId: string, availability: DriverAvailability) {
    const driver = await this.getDriver(driverId);
    const timestamp = nowIso();

    await this.d1.execute(
      `
        UPDATE drivers
        SET availability = ?, updated_at = ?
        WHERE id = ?
      `,
      [availability, timestamp, driverId],
    );

    return {
      ...driver,
      availability,
    };
  }

  async updateDriverLocation(driverId: string, location: DriverLocationUpdate) {
    const driver = await this.getDriver(driverId);
    const timestamp = nowIso();

    await this.d1.execute(
      `
        UPDATE drivers
        SET last_known_latitude = ?, last_known_longitude = ?, last_location_at = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        location.point.latitude,
        location.point.longitude,
        timestamp,
        timestamp,
        driverId,
      ],
    );

    return {
      ...driver,
      lastKnownLocation: location.point,
      lastLocationAt: timestamp,
    };
  }

  async registerDriverDevice(
    driverId: string,
    registration: DriverDeviceRegistration,
  ) {
    await this.getDriver(driverId);
    const timestamp = nowIso();

    if (registration.platform === "expo") {
      await this.d1.execute(
        `
          DELETE FROM driver_devices
          WHERE driver_id = ? AND platform = 'expo' AND expo_push_token = ?
        `,
        [driverId, registration.expoPushToken],
      );
    } else {
      await this.d1.execute(
        `
          DELETE FROM driver_devices
          WHERE driver_id = ? AND platform = 'web' AND endpoint = ?
        `,
        [driverId, registration.endpoint],
      );
    }

    await this.d1.execute(
      `
        INSERT INTO driver_devices (
          id, driver_id, platform, expo_push_token, endpoint, subscription_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId("device"),
        driverId,
        registration.platform,
        registration.platform === "expo" ? registration.expoPushToken : null,
        registration.platform === "web" ? registration.endpoint : null,
        registration.platform === "web" ? JSON.stringify(registration) : null,
        timestamp,
        timestamp,
      ],
    );
  }

  async listCandidateDrivers() {
    const rows = await this.d1.queryMany<DriverRow>(`
      SELECT
        d.*,
        COALESCE((
          SELECT COUNT(*) FROM orders o
          WHERE o.assigned_driver_id = d.id
            AND o.status IN ('accepted', 'on_the_way', 'picked_up')
        ), 0) AS active_order_count
      FROM drivers d
      WHERE d.availability = 'online'
      ORDER BY d.updated_at DESC
    `);

    const drivers = await Promise.all(
      rows.map(async (row) => toDriver(row, await this.getDriverDevices(row.id))),
    );

    return drivers;
  }

  async createOrder(input: CreateOrderInput, trackingToken: string) {
    const timestamp = nowIso();
    const orderId = createId("ord");

    await this.d1.execute(
      `
        INSERT INTO orders (
          id, customer_name, customer_phone_number, pickup_json, dropoff_json, notes,
          priority, status, assigned_driver_id, tracking_token, customer_webhook_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        orderId,
        input.customerName,
        input.customerPhoneNumber ?? null,
        JSON.stringify(input.pickup),
        JSON.stringify(input.dropoff),
        input.notes ?? null,
        input.priority,
        "pending_assignment",
        null,
        trackingToken,
        input.customerWebhookUrl ?? null,
        timestamp,
        timestamp,
      ],
    );

    await this.addOrderEvent({
      orderId,
      status: "pending_assignment",
      happenedAt: timestamp,
      note: "Order created and queued for allocation.",
    });

    return this.getOrder(orderId);
  }

  async getOrder(orderId: string) {
    const row = await this.d1.queryOne<OrderRow>(
      `
        SELECT * FROM orders WHERE id = ?
      `,
      [orderId],
    );

    if (!row) {
      throw new AppError(404, "ORDER_NOT_FOUND", `Order ${orderId} was not found.`);
    }

    return toOrder(row);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    await this.d1.execute(
      `
        UPDATE orders
        SET status = ?, updated_at = ?
        WHERE id = ?
      `,
      [status, nowIso(), orderId],
    );

    return this.getOrder(orderId);
  }

  async assignOrder(orderId: string, driverId: string) {
    await this.d1.execute(
      `
        UPDATE orders
        SET assigned_driver_id = ?, status = 'accepted', updated_at = ?
        WHERE id = ?
      `,
      [driverId, nowIso(), orderId],
    );

    return this.getOrder(orderId);
  }

  async listDriverOffers(driverId: string) {
    const rows = await this.d1.queryMany<OfferRow>(
      `
        SELECT * FROM order_offers
        WHERE driver_id = ? AND status = 'pending'
        ORDER BY offered_at DESC
      `,
      [driverId],
    );

    return rows.map((row) => toOffer(row));
  }

  async listOrderOffers(orderId: string) {
    const rows = await this.d1.queryMany<OfferRow>(
      `
        SELECT * FROM order_offers
        WHERE order_id = ?
        ORDER BY offered_at ASC
      `,
      [orderId],
    );

    return rows.map((row) => toOffer(row));
  }

  async saveOffers(orderId: string, offers: Offer[]) {
    const timestamp = nowIso();
    await this.d1.batch([
      {
        sql: `DELETE FROM order_offers WHERE order_id = ?`,
        params: [orderId],
      },
      ...offers.map((offer) => ({
        sql: `
          INSERT INTO order_offers (
            id, order_id, driver_id, status, score, pickup_distance_km,
            pickup_json, dropoff_json, offered_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          createId("offer"),
          offer.orderId,
          offer.driverId,
          offer.status,
          offer.score,
          offer.pickupDistanceKm,
          JSON.stringify(offer.pickup),
          JSON.stringify(offer.dropoff),
          offer.offeredAt,
          offer.expiresAt,
        ],
      })),
      {
        sql: `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`,
        params: [offers.length ? "offer_sent" : "no_driver_found", timestamp, orderId],
      },
    ]);
  }

  async updateOfferStatus(orderId: string, driverId: string, status: OfferStatus) {
    await this.d1.execute(
      `
        UPDATE order_offers
        SET status = ?
        WHERE order_id = ? AND driver_id = ?
      `,
      [status, orderId, driverId],
    );
  }

  async addOrderEvent(event: OrderEvent) {
    await this.d1.execute(
      `
        INSERT INTO order_events (
          id, order_id, status, note, happened_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        createId("evt"),
        event.orderId,
        event.status,
        event.note ?? null,
        event.happenedAt,
      ],
    );
  }

  async listOrderEvents(orderId: string) {
    const rows = await this.d1.queryMany<EventRow>(
      `
        SELECT * FROM order_events
        WHERE order_id = ?
        ORDER BY happened_at ASC
      `,
      [orderId],
    );

    return rows.map((row) => toEvent(row));
  }

  async findOrderByTrackingToken(token: string) {
    const row = await this.d1.queryOne<OrderRow>(
      `
        SELECT * FROM orders
        WHERE tracking_token = ?
      `,
      [token],
    );

    return row ? toOrder(row) : null;
  }

  async getDriverDevices(driverId: string) {
    const rows = await this.d1.queryMany<DeviceRow>(
      `
        SELECT * FROM driver_devices
        WHERE driver_id = ?
      `,
      [driverId],
    );

    return rows.map((row) => toDevice(row));
  }

  async getDriverActiveOrder(driverId: string) {
    const row = await this.d1.queryOne<OrderRow>(
      `
        SELECT * FROM orders
        WHERE assigned_driver_id = ?
          AND status IN ('accepted', 'on_the_way', 'picked_up')
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [driverId],
    );

    return row ? toOrder(row) : null;
  }
}
