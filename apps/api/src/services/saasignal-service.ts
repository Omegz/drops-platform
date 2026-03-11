import { SaaSignalClient } from "saasignal";
import type { DriverLocationUpdate, Offer, Order } from "@drops/contracts";
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

const trackingChannel = (trackingToken: string) => `tracking:${trackingToken}`;
const driverChannel = (driverId: string) => `drivers:${driverId}`;
const orderChannel = (orderId: string) => `orders:${orderId}`;

export class SaaSignalDispatchService {
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
}
