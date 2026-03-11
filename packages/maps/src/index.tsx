import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Rect, Stop } from "react-native-svg";
import type { Coordinate, MapStop, TaskMap } from "@drops/contracts";
import { palette } from "@drops/ui";

const COPENHAGEN_BOUNDS = {
  minLatitude: 55.58,
  maxLatitude: 55.74,
  minLongitude: 12.45,
  maxLongitude: 12.69,
};

const projectPoint = (point: Coordinate) => {
  const width = 1000;
  const height = 1000;
  const x =
    ((point.longitude - COPENHAGEN_BOUNDS.minLongitude) /
      (COPENHAGEN_BOUNDS.maxLongitude - COPENHAGEN_BOUNDS.minLongitude)) *
    width;
  const y =
    height -
    ((point.latitude - COPENHAGEN_BOUNDS.minLatitude) /
      (COPENHAGEN_BOUNDS.maxLatitude - COPENHAGEN_BOUNDS.minLatitude)) *
      height;

  return { x, y };
};

const routePoints = (map: TaskMap) =>
  map.route?.points.map((point) => {
    const projected = projectPoint(point);
    return `${projected.x},${projected.y}`;
  }) ?? [];

const toneForStop = (kind: MapStop["kind"]) =>
  kind === "pickup" ? palette.pickup : kind === "dropoff" ? palette.dropoff : palette.driver;

const labelForStop = (stop: MapStop) => (stop.kind === "driver" ? "Driver" : stop.label);

const Marker = ({
  stop,
  emphasized,
  onPress,
}: {
  stop: MapStop;
  emphasized?: boolean;
  onPress?: () => void;
}) => {
  const projected = projectPoint(stop.point);
  const color = toneForStop(stop.kind);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.markerWrap,
        {
          left: `${projected.x / 10}%`,
          top: `${projected.y / 10}%`,
        },
      ]}
    >
      <View
        style={[
          styles.markerHalo,
          {
            borderColor: color,
            transform: [{ scale: emphasized ? 1.1 : 0.92 }],
          },
        ]}
      />
      <View style={[styles.markerDot, { backgroundColor: color }]} />
      <View style={[styles.labelPill, { borderColor: color }]}>
        <Text style={[styles.labelText, { color }]}>{labelForStop(stop)}</Text>
      </View>
    </Pressable>
  );
};

export const buildSyntheticRoute = (
  start: Coordinate,
  end: Coordinate,
): Coordinate[] => {
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

export const NightCityMap = ({
  map,
  title,
  subtitle,
  onPrimaryPress,
  onSecondaryPress,
  children,
}: PropsWithChildren<{
  map: TaskMap;
  title?: string;
  subtitle?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
}>) => {
  const route = routePoints(map);
  const primaryStop = map.primaryStop;
  const secondaryStop = map.secondaryStop;

  return (
    <View style={styles.shell}>
      <Svg viewBox="0 0 1000 1000" style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="routeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.driver} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={palette.pickup} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect width="1000" height="1000" fill="#040711" />
        <Path
          d="M-20 180 C 240 120 280 380 530 320 S 810 80 1040 210"
          stroke="#101938"
          strokeWidth="34"
          fill="none"
          strokeOpacity="0.9"
        />
        <Path
          d="M-10 610 C 180 520 300 680 480 620 S 760 460 1020 580"
          stroke="#0D1430"
          strokeWidth="42"
          fill="none"
          strokeOpacity="0.95"
        />
        <Path
          d="M90 -40 C 130 180 300 240 280 470 S 390 820 610 1020"
          stroke="#0D1736"
          strokeWidth="26"
          fill="none"
          strokeOpacity="0.75"
        />
        {route.length ? (
          <>
            <Polyline
              points={route.join(" ")}
              stroke={palette.driver}
              strokeOpacity="0.26"
              strokeWidth="26"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polyline
              points={route.join(" ")}
              stroke="url(#routeGlow)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        <Circle cx="210" cy="220" r="88" fill="#152041" fillOpacity="0.5" />
        <Circle cx="790" cy="730" r="110" fill="#1A1025" fillOpacity="0.48" />
      </Svg>

      <View style={styles.cityGlow} />
      <View style={styles.overlay}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {primaryStop ? <Marker stop={primaryStop} emphasized onPress={onPrimaryPress} /> : null}
      {secondaryStop ? <Marker stop={secondaryStop} onPress={onSecondaryPress} /> : null}
      {children ? <View style={styles.childrenLayer}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  childrenLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  cityGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderColor: "rgba(97,216,255,0.08)",
    borderWidth: 1,
  },
  labelPill: {
    backgroundColor: "rgba(5,8,22,0.92)",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  markerDot: {
    borderRadius: 999,
    height: 18,
    width: 18,
  },
  markerHalo: {
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    opacity: 0.42,
    position: "absolute",
    top: -15,
    width: 48,
  },
  markerWrap: {
    alignItems: "center",
    marginLeft: -18,
    marginTop: -18,
    position: "absolute",
  },
  overlay: {
    left: 18,
    position: "absolute",
    right: 18,
    top: 18,
  },
  shell: {
    backgroundColor: palette.background,
    borderColor: palette.border,
    borderRadius: 34,
    borderWidth: 1,
    height: 430,
    overflow: "hidden",
    position: "relative",
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: "78%",
  },
  title: {
    color: palette.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0.4,
    maxWidth: "72%",
  },
});
