import type {
  AppRole,
  CreateOrderInput,
  CustomerOrderView,
  Driver,
  DriverAvailability,
  DriverDashboard,
  DriverDeviceRegistration,
  DriverInvitation,
  DriverLocationUpdate,
  MagicLinkRequest,
  MagicLinkResponse,
  SessionState,
  TrackingSnapshot,
} from "@drops/contracts";
import { createAuthHeaders } from "@drops/auth-client";
import { Platform } from "react-native";

const inferApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (Platform.OS !== "web") {
    return "http://localhost:3000";
  }

  if (typeof window === "undefined") {
    return "";
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3000"
    : "";
};

export const API_BASE_URL = inferApiBaseUrl();
export const buildGoogleSignInUrl = (next = "/customer") =>
  `${API_BASE_URL}/api/auth/google/start?next=${encodeURIComponent(next)}`;

type ApiEnvelope<T> = {
  data: T;
  requestId: string;
};

type RealtimeCredentials = {
  channel: string;
  subscribeUrl: string;
  expiresAt: string;
};

class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  sessionToken?: string | null,
): Promise<T> {
  const hasBody = init?.body !== undefined;
  const headers = new Headers(init?.headers);

  if (hasBody) {
    headers.set("content-type", "application/json");
  }

  for (const [key, value] of Object.entries(createAuthHeaders(sessionToken))) {
    headers.set(key, value);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? "Request failed");
  }

  return (payload as ApiEnvelope<T>).data;
}

export const api = {
  fetchSessionState: (sessionToken?: string | null) =>
    apiFetch<SessionState>("/api/auth/session", undefined, sessionToken),
  requestMagicLink: (payload: MagicLinkRequest) =>
    apiFetch<MagicLinkResponse>("/api/auth/magic-links/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  signOut: (sessionToken?: string | null) =>
    apiFetch<{ ok: true }>("/api/auth/sign-out", { method: "POST" }, sessionToken),
  switchActiveRole: (role: AppRole, sessionToken?: string | null) =>
    apiFetch<SessionState>(
      "/api/v1/me/active-role",
      {
        method: "POST",
        body: JSON.stringify({ role }),
      },
      sessionToken,
    ),
  fetchCurrentCustomerOrder: (sessionToken?: string | null) =>
    apiFetch<CustomerOrderView | null>(
      "/api/v1/customer/orders/current",
      undefined,
      sessionToken,
    ),
  createCustomerOrder: (input: CreateOrderInput, sessionToken?: string | null) =>
    apiFetch<CustomerOrderView>(
      "/api/v1/customer/orders",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      sessionToken,
    ),
  fetchCustomerOrder: (orderId: string, sessionToken?: string | null) =>
    apiFetch<CustomerOrderView>(
      `/api/v1/customer/orders/${orderId}`,
      undefined,
      sessionToken,
    ),
  fetchDriverDashboard: (sessionToken?: string | null) =>
    apiFetch<DriverDashboard>("/api/v1/driver/dashboard", undefined, sessionToken),
  setDriverAvailability: (
    availability: DriverAvailability,
    sessionToken?: string | null,
  ) =>
    apiFetch<Driver>(
      "/api/v1/driver/status",
      {
        method: "POST",
        body: JSON.stringify(availability),
      },
      sessionToken,
    ),
  updateDriverLocation: (
    location: DriverLocationUpdate,
    sessionToken?: string | null,
  ) =>
    apiFetch<Driver>(
      "/api/v1/driver/location",
      {
        method: "POST",
        body: JSON.stringify(location),
      },
      sessionToken,
    ),
  registerDriverDevice: (
    registration: DriverDeviceRegistration,
    sessionToken?: string | null,
  ) =>
    apiFetch<{ ok: true }>(
      "/api/v1/driver/devices",
      {
        method: "POST",
        body: JSON.stringify(registration),
      },
      sessionToken,
    ),
  respondToOffer: (
    orderId: string,
    decision: "accept" | "reject",
    sessionToken?: string | null,
  ) =>
    apiFetch<DriverDashboard>(
      `/api/v1/driver/offers/${orderId}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision }),
      },
      sessionToken,
    ),
  updateOrderStatus: (
    orderId: string,
    status: "accepted" | "on_the_way" | "picked_up" | "dropped_off" | "cancelled",
    sessionToken?: string | null,
  ) =>
    apiFetch<DriverDashboard["activeAssignment"]>(
      `/api/v1/driver/orders/${orderId}/status`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      },
      sessionToken,
    ),
  fetchTracking: (trackingToken: string) =>
    apiFetch<TrackingSnapshot>(`/api/v1/tracking/${trackingToken}`),
  fetchDriverRealtimeCredentials: (sessionToken?: string | null) =>
    apiFetch<RealtimeCredentials>(
      "/api/v1/realtime/driver/subscribe",
      undefined,
      sessionToken,
    ),
  fetchTrackingRealtimeCredentials: (trackingToken: string) =>
    apiFetch<RealtimeCredentials>(
      `/api/v1/realtime/tracking/${trackingToken}/subscribe`,
    ),
  createDriverInvitation: (
    payload: {
      email: string;
      driverName: string;
      vehicleLabel: string;
    },
    sessionToken?: string | null,
  ) =>
    apiFetch<DriverInvitation>(
      "/api/v1/admin/driver-invitations",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      sessionToken,
    ),
};
