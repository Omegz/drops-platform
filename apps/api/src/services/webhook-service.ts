import type { Order } from "@drops/contracts";
import { createHmac } from "node:crypto";
import { env } from "../lib/env.js";

export class CustomerWebhookService {
  async deliver(
    targetUrl: string,
    event: string,
    orderId: string,
    payload: Record<string, unknown>,
  ) {
    const body = JSON.stringify({
      event,
      orderId,
      payload,
      happenedAt: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (env.customerWebhookSigningSecret) {
      headers["x-drops-signature"] = createHmac(
        "sha256",
        env.customerWebhookSigningSecret,
      )
        .update(body)
        .digest("hex");
    }

    await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
    }).catch(() => undefined);
  }

  async emit(
    order: Order,
    event: string,
    payload: Record<string, unknown>,
  ) {
    if (!order.customerWebhookUrl) {
      return;
    }

    await this.deliver(order.customerWebhookUrl, event, order.id, payload);
  }
}
