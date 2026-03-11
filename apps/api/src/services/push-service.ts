import type { Offer, Order } from "@drops/contracts";
import webpush from "web-push";
import { env } from "../lib/env.js";
import { buildTrackingUrl } from "../lib/navigation.js";
import type { DispatchRepository } from "./repository.js";

export class PushService {
  constructor(private readonly repository: DispatchRepository) {
    if (env.webPushPublicKey && env.webPushPrivateKey) {
      webpush.setVapidDetails(
        env.webPushSubject,
        env.webPushPublicKey,
        env.webPushPrivateKey,
      );
    }
  }

  async sendOrderOffer(driverId: string, order: Order, offer: Offer) {
    const devices = await this.repository.getDriverDevices(driverId);

    if (!devices.length) {
      return;
    }

    const payload = JSON.stringify({
      type: "order.offer",
      orderId: order.id,
      expiresAt: offer.expiresAt,
      pickupAddress: order.pickup.addressLine,
      dropoffAddress: order.dropoff.addressLine,
      status: order.status,
      trackingUrl: buildTrackingUrl(env.appBaseUrl, order.trackingToken),
    });

    await Promise.allSettled(
      devices.map(async (device) => {
        if (device.platform === "expo") {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              to: device.expoPushToken,
              title: "New pickup offer",
              body: `${order.pickup.addressLine} -> ${order.dropoff.addressLine}`,
              data: {
                orderId: order.id,
              },
            }),
          });
          return;
        }

        if (env.webPushPublicKey && env.webPushPrivateKey) {
          await webpush.sendNotification(
            {
              endpoint: device.endpoint,
              keys: device.keys,
            },
            payload,
          );
        }
      }),
    );
  }
}
