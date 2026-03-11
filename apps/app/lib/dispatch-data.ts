import type {
  ActiveLeg,
  AddressPoint,
  Coordinate,
  CreateOrderInput,
  CreatePublicOrderInput,
  LogisticsPlace,
  Offer,
  OrderStatus,
  TaskMap,
  TrackingSnapshot,
} from "@drops/contracts";
import { buildSyntheticRoute } from "@drops/maps";

export type DispatchPlace = LogisticsPlace & {
  subtitle?: string;
};

export const defaultPlaces: DispatchPlace[] = [
  {
    id: "nyhavn",
    label: "Nyhavn Harbor",
    subtitle: "Canal edge pickup",
    addressLine: "Nyhavn 1, Copenhagen",
    point: { latitude: 55.6799, longitude: 12.5911 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "norreport",
    label: "Norreport Station",
    subtitle: "High-volume transfer hub",
    addressLine: "Norre Voldgade 90, Copenhagen",
    point: { latitude: 55.6834, longitude: 12.5717 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "tivoli",
    label: "Tivoli Gardens",
    subtitle: "Central guest entrance",
    addressLine: "Vesterbrogade 3, Copenhagen",
    point: { latitude: 55.6736, longitude: 12.5681 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "opera",
    label: "Opera House",
    subtitle: "Waterfront destination",
    addressLine: "Ekvipagemestervej 10, Copenhagen",
    point: { latitude: 55.6826, longitude: 12.6006 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "drbyen",
    label: "DR Byen",
    subtitle: "Amager pickup zone",
    addressLine: "Emil Holms Kanal 20, Copenhagen",
    point: { latitude: 55.6634, longitude: 12.5855 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "refshaleoen",
    label: "Refshaleoen",
    subtitle: "Creative district",
    addressLine: "Refshalevej 167A, Copenhagen",
    point: { latitude: 55.6921, longitude: 12.6188 },
    source: "local-fallback",
    kind: "address",
  },
  {
    id: "bella",
    label: "Bella Center",
    subtitle: "South city conference zone",
    addressLine: "Center Boulevard 5, Copenhagen",
    point: { latitude: 55.6372, longitude: 12.5788 },
    source: "local-fallback",
    kind: "address",
  },
];

export const locationPresets = defaultPlaces;

export const previewMap: TaskMap = {
  activeLeg: "to_pickup",
  etaMinutes: 8,
  primaryStop: {
    kind: "pickup",
    label: "Pickup",
    point: defaultPlaces[0]!.point,
  },
  secondaryStop: {
    kind: "dropoff",
    label: "Dropoff",
    point: defaultPlaces[3]!.point,
  },
  route: {
    provider: "local-fallback",
    etaMinutes: 8,
    distanceKm: 4.1,
    points: buildSyntheticRoute(defaultPlaces[0]!.point, defaultPlaces[3]!.point),
  },
  bounds: {
    northEast: { latitude: 55.6926, longitude: 12.6022 },
    southWest: { latitude: 55.678, longitude: 12.5895 },
  },
};

export const searchSeedPlaces = (query: string) => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return defaultPlaces;
  }

  return defaultPlaces.filter((location) =>
    [location.label, location.subtitle, location.addressLine]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
};

export const toAddressPoint = (
  location: DispatchPlace,
  instructions?: string,
): AddressPoint => ({
  addressLine: location.addressLine,
  instructions,
  point: location.point,
});

export const buildComposerOrderInput = ({
  customerName,
  customerPhoneNumber,
  notes,
  priority,
  pickup,
  dropoff,
}: {
  customerName: string;
  customerPhoneNumber: string;
  notes: string;
  priority: CreateOrderInput["priority"];
  pickup: DispatchPlace;
  dropoff: DispatchPlace;
}): CreateOrderInput => ({
  customerName,
  customerPhoneNumber: customerPhoneNumber.trim() || undefined,
  notes: notes.trim() || undefined,
  priority,
  pickup: toAddressPoint(pickup),
  dropoff: toAddressPoint(dropoff),
});

export const buildPublicComposerOrderInput = ({
  pickup,
  dropoff,
  notes,
  priority,
}: {
  pickup: DispatchPlace;
  dropoff: DispatchPlace;
  notes?: string;
  priority: CreatePublicOrderInput["priority"];
}): CreatePublicOrderInput => ({
  pickup: toAddressPoint(pickup),
  dropoff: toAddressPoint(dropoff),
  notes: notes?.trim() || undefined,
  priority,
});

const buildBounds = (points: Coordinate[]) => ({
  northEast: {
    latitude: Math.max(...points.map((point) => point.latitude)),
    longitude: Math.max(...points.map((point) => point.longitude)),
  },
  southWest: {
    latitude: Math.min(...points.map((point) => point.latitude)),
    longitude: Math.min(...points.map((point) => point.longitude)),
  },
});

export const buildPairMap = (
  pickup: AddressPoint,
  dropoff: AddressPoint,
  activeLeg: ActiveLeg = "to_pickup",
): TaskMap => {
  const points = buildSyntheticRoute(pickup.point, dropoff.point);

  return {
    activeLeg,
    etaMinutes: activeLeg === "to_pickup" ? 8 : 14,
    primaryStop: {
      kind: activeLeg === "to_dropoff" ? "dropoff" : "pickup",
      label: activeLeg === "to_dropoff" ? "Dropoff" : "Pickup",
      point: activeLeg === "to_dropoff" ? dropoff.point : pickup.point,
    },
    secondaryStop: {
      kind: activeLeg === "to_dropoff" ? "pickup" : "dropoff",
      label: activeLeg === "to_dropoff" ? "Pickup" : "Dropoff",
      point: activeLeg === "to_dropoff" ? pickup.point : dropoff.point,
    },
    route: {
      provider: "local-fallback",
      etaMinutes: activeLeg === "to_dropoff" ? 14 : 8,
      distanceKm: activeLeg === "to_dropoff" ? 6.8 : 3.9,
      points,
    },
    bounds: buildBounds(points),
  };
};

export const buildIdleMap = (point?: Coordinate | null): TaskMap => {
  const driverPoint = point ?? { latitude: 55.6761, longitude: 12.5683 };
  const routePoints = buildSyntheticRoute(driverPoint, {
    latitude: driverPoint.latitude + 0.01,
    longitude: driverPoint.longitude + 0.015,
  });

  return {
    activeLeg: "unassigned",
    etaMinutes: null,
    primaryStop: {
      kind: "driver",
      label: "Driver",
      point: driverPoint,
    },
    secondaryStop: null,
    route: {
      provider: "local-fallback",
      etaMinutes: null,
      distanceKm: 2.4,
      points: routePoints,
    },
    bounds: buildBounds(routePoints),
  };
};

export const buildOfferMap = (offer: Offer): TaskMap =>
  buildPairMap(offer.pickup, offer.dropoff, "to_pickup");

export const buildTrackingMarkers = (tracking: TrackingSnapshot) => {
  const markers: Array<{
    stop: {
      kind: "pickup" | "dropoff" | "driver";
      label: string;
      point: Coordinate;
    };
    emphasized?: boolean;
  }> = [];

  if (tracking.map.primaryStop) {
    markers.push({ stop: tracking.map.primaryStop, emphasized: true });
  }

  if (tracking.driver?.point) {
    markers.push({
      stop: {
        kind: "driver",
        label: tracking.driver.name || "Driver",
        point: tracking.driver.point,
      },
    });
  }

  if (tracking.map.secondaryStop) {
    const alreadyAdded = markers.some(
      (marker) =>
        marker.stop.kind === tracking.map.secondaryStop?.kind &&
        marker.stop.point.latitude === tracking.map.secondaryStop.point.latitude &&
        marker.stop.point.longitude === tracking.map.secondaryStop.point.longitude,
    );

    if (!alreadyAdded) {
      markers.push({ stop: tracking.map.secondaryStop });
    }
  }

  return markers;
};

export const orderStatusCopy: Record<
  OrderStatus,
  { label: string; detail: string }
> = {
  pending_assignment: {
    label: "Matching the closest available driver",
    detail: "Dispatch is comparing distance, live load, and route freshness.",
  },
  offer_sent: {
    label: "Offer sent to the best-fit drivers",
    detail: "The first qualified driver to accept wins the run.",
  },
  accepted: {
    label: "Driver locked in",
    detail: "The assigned driver is preparing to head to pickup.",
  },
  on_the_way: {
    label: "Driver en route to pickup",
    detail: "Live position is updating while they approach your location.",
  },
  picked_up: {
    label: "Trip in progress",
    detail: "The active route has switched to the dropoff leg.",
  },
  dropped_off: {
    label: "Completed",
    detail: "The order is closed and the driver is back in the queue.",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This run has been cancelled from the dispatch flow.",
  },
  no_driver_found: {
    label: "No driver matched",
    detail: "No suitable online driver accepted the request in time.",
  },
};

export const formatEta = (etaMinutes: number | null | undefined) =>
  etaMinutes === null || etaMinutes === undefined ? "Live" : `${etaMinutes} min`;

export const formatCountdown = (expiresAt: string) => {
  const ms = new Date(expiresAt).getTime() - Date.now();

  if (ms <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
