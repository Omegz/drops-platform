import type {
  Coordinate,
  DispatchCandidate,
  Driver,
  Order,
  TaskMap,
  TrackingDriver,
} from "@drops/contracts";
import { haversineDistanceKm } from "../lib/haversine.js";
import type { SaaSignalDispatchService } from "./saasignal-service.js";

const buildRoutePoints = (start: Coordinate, end: Coordinate): Coordinate[] => {
  const midpoint = {
    latitude: (start.latitude + end.latitude) / 2 + 0.006,
    longitude: (start.longitude + end.longitude) / 2 - 0.005,
  };

  return [
    start,
    {
      latitude: (start.latitude * 2 + midpoint.latitude) / 3,
      longitude: (start.longitude * 2 + midpoint.longitude) / 3,
    },
    midpoint,
    {
      latitude: (end.latitude * 2 + midpoint.latitude) / 3,
      longitude: (end.longitude * 2 + midpoint.longitude) / 3,
    },
    end,
  ];
};

const toEtaMinutes = (distanceKm: number) => Math.max(3, Math.round((distanceKm / 0.42) * 10) / 10);

const hasTrackingPoint = (
  driver: DriverPointCarrier,
): driver is TrackingDriver => "point" in driver;

export class SaaSignalLogisticsService {
  constructor(
    private readonly providerLabel = "saasignal-logistics",
    private readonly saasignalService: SaaSignalDispatchService | null = null,
  ) {}

  async rankDrivers(candidates: Driver[], order: Order): Promise<DispatchCandidate[]> {
    if (this.saasignalService) {
      try {
        const ranked = await this.saasignalService.suggestDriversForOrder(order, candidates);
        if (ranked.length) {
          return ranked;
        }
      } catch {
        // Fall back to local ranking when SaaSignal is unavailable or unseeded.
      }
    }

    return candidates
      .filter((driver) => driver.lastKnownLocation)
      .map((driver) => {
        const distanceKm = haversineDistanceKm(driver.lastKnownLocation!, order.pickup.point);
        const loadPenalty = driver.activeOrderCount * 3.5;
        const stalePenalty = driver.lastLocationAt
          ? Math.min(
              5,
              (Date.now() - new Date(driver.lastLocationAt).getTime()) / 300_000,
            )
          : 10;
        const priorityBoost = order.priority === "priority" ? -1.5 : 0;
        const score = Number(
          (distanceKm * 1.15 + loadPenalty + stalePenalty + priorityBoost).toFixed(2),
        );

        return {
          driverId: driver.id,
          distanceKm: Number(distanceKm.toFixed(2)),
          activeOrderCount: driver.activeOrderCount,
          score,
          rationale: `eta ${toEtaMinutes(distanceKm)}m + load ${driver.activeOrderCount} + freshness penalty ${stalePenalty.toFixed(1)}`,
        };
      })
      .sort((left, right) => left.score - right.score);
  }

  async buildTaskMap(order: Order, driver: DriverPointCarrier | null): Promise<TaskMap> {
    const activeLeg =
      order.status === "accepted" || order.status === "on_the_way"
        ? "to_pickup"
        : order.status === "picked_up"
          ? "to_dropoff"
          : order.status === "dropped_off"
            ? "completed"
            : "unassigned";

    const driverPoint = driver
      ? hasTrackingPoint(driver)
        ? driver.point
        : driver.lastKnownLocation
      : null;
    const primaryStop =
      activeLeg === "to_pickup"
        ? {
            kind: "pickup" as const,
            label: "Pickup",
            point: order.pickup.point,
          }
        : activeLeg === "to_dropoff"
          ? {
              kind: "dropoff" as const,
              label: "Dropoff",
              point: order.dropoff.point,
            }
          : null;
    const secondaryStop =
      activeLeg === "to_pickup"
        ? {
            kind: "dropoff" as const,
            label: "Dropoff",
            point: order.dropoff.point,
          }
        : activeLeg === "to_dropoff"
          ? {
              kind: "pickup" as const,
              label: "Pickup",
              point: order.pickup.point,
            }
          : driverPoint
            ? {
                kind: "driver" as const,
                label: "Driver",
                point: driverPoint,
              }
            : null;

    const routeStart =
      activeLeg === "to_pickup"
        ? driverPoint ?? order.pickup.point
        : activeLeg === "to_dropoff"
          ? driverPoint ?? order.pickup.point
          : order.pickup.point;
    const routeEnd =
      activeLeg === "to_pickup"
        ? order.pickup.point
        : activeLeg === "to_dropoff"
          ? order.dropoff.point
          : order.dropoff.point;

    const saasignalRoute = await this.buildSaaSignalRoute(routeStart, routeEnd);
    const distanceKm =
      saasignalRoute?.distanceKm ?? haversineDistanceKm(routeStart, routeEnd);
    const points = saasignalRoute?.points.length
      ? saasignalRoute.points
      : buildRoutePoints(routeStart, routeEnd);
    const etaMinutes =
      saasignalRoute?.etaMinutes ?? (activeLeg === "completed" ? 0 : toEtaMinutes(distanceKm));

    return {
      activeLeg,
      etaMinutes,
      primaryStop,
      secondaryStop,
      route: {
        provider: saasignalRoute?.provider ?? this.providerLabel,
        etaMinutes,
        distanceKm: Number(distanceKm.toFixed(2)),
        points,
      },
      bounds: {
        northEast: {
          latitude: Math.max(...points.map((point) => point.latitude)),
          longitude: Math.max(...points.map((point) => point.longitude)),
        },
        southWest: {
          latitude: Math.min(...points.map((point) => point.latitude)),
          longitude: Math.min(...points.map((point) => point.longitude)),
        },
      },
    };
  }

  private async buildSaaSignalRoute(origin: Coordinate, destination: Coordinate) {
    if (!this.saasignalService) {
      return null;
    }

    try {
      return await this.saasignalService.buildRoute(origin, destination);
    } catch {
      return null;
    }
  }
}
type DriverPointCarrier =
  | TrackingDriver
  | (Driver & {
      lastKnownLocation: Coordinate | null;
      lastLocationAt: string | null;
    });
