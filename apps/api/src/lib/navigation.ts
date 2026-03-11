import type { Coordinate } from "@drops/contracts";

const encodeCoordinate = (point: Coordinate) =>
  `${point.latitude},${point.longitude}`;

export const buildGoogleMapsDirectionsUrl = (destination: Coordinate) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    encodeCoordinate(destination),
  )}&travelmode=driving`;

export const buildTrackingUrl = (appBaseUrl: string, trackingToken: string) =>
  `${appBaseUrl.replace(/\/$/, "")}/track/${trackingToken}`;
