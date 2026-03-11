import type {
  DriverAvailability,
  DriverDashboard,
  DriverDeviceRegistration,
  DriverLocationUpdate,
  TrackingSnapshot,
} from "@drops/contracts";
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

  return window.location.hostname === "localhost" ? "http://localhost:3000" : "";
};

const API_BASE_URL = inferApiBaseUrl();

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
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? "Request failed");
  }

  return (payload as ApiEnvelope<T>).data;
}

export const api = {
  fetchDriverDashboard: (driverId: string) =>
    apiFetch<DriverDashboard>(`/api/v1/drivers/${driverId}/dashboard`),
  setDriverAvailability: (driverId: string, availability: DriverAvailability) =>
    apiFetch(`/api/v1/drivers/${driverId}/status`, {
      method: "POST",
      body: JSON.stringify(availability),
    }),
  updateDriverLocation: (driverId: string, location: DriverLocationUpdate) =>
    apiFetch(`/api/v1/drivers/${driverId}/location`, {
      method: "POST",
      body: JSON.stringify(location),
    }),
  registerDriverDevice: (driverId: string, registration: DriverDeviceRegistration) =>
    apiFetch(`/api/v1/drivers/${driverId}/devices`, {
      method: "POST",
      body: JSON.stringify(registration),
    }),
  respondToOffer: (driverId: string, orderId: string, decision: "accept" | "reject") =>
    apiFetch<DriverDashboard>(
      `/api/v1/drivers/${driverId}/offers/${orderId}/decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision }),
      },
    ),
  updateOrderStatus: (
    driverId: string,
    orderId: string,
    status: "on_the_way" | "picked_up" | "dropped_off" | "cancelled",
  ) =>
    apiFetch(`/api/v1/drivers/${driverId}/orders/${orderId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  fetchTracking: (trackingToken: string) =>
    apiFetch<TrackingSnapshot>(`/api/v1/tracking/${trackingToken}`),
  fetchDriverRealtimeCredentials: (driverId: string) =>
    apiFetch<RealtimeCredentials>(`/api/v1/realtime/drivers/${driverId}/subscribe`),
  fetchTrackingRealtimeCredentials: (trackingToken: string) =>
    apiFetch<RealtimeCredentials>(
      `/api/v1/realtime/tracking/${trackingToken}/subscribe`,
    ),
  createDemoOrder: () =>
    apiFetch(`/api/v1/orders`, {
      method: "POST",
      body: JSON.stringify({
        customerName: "Dispatch Sandbox",
        customerPhoneNumber: "+45 11 22 33 44",
        priority: "priority",
        pickup: {
          addressLine: "Nordre Toldbod 18, Copenhagen",
          point: { latitude: 55.6929, longitude: 12.5993 },
        },
        dropoff: {
          addressLine: "Kongens Nytorv 1, Copenhagen",
          point: { latitude: 55.6798, longitude: 12.5851 },
        },
        notes: "Demo payload from driver PWA",
      }),
    }),
};
