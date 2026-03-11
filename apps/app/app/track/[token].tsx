import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Panel } from "../../components/Panel";
import { RouteStrip } from "../../components/RouteStrip";
import { StatusBadge } from "../../components/StatusBadge";
import { api } from "../../lib/api";
import { bindWebEventSource } from "../../lib/realtime";

export default function PublicTrackingScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const trackingQuery = useQuery({
    queryKey: ["tracking", token],
    enabled: Boolean(token),
    queryFn: () => api.fetchTracking(token),
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!token || Platform.OS !== "web") {
      return;
    }

    let dispose: () => void = () => {};
    let cancelled = false;

    void api
      .fetchTrackingRealtimeCredentials(token)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void trackingQuery.refetch();
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [token, trackingQuery]);

  if (!token || trackingQuery.isLoading) {
    return (
      <View style={styles.loaderShell}>
        <ActivityIndicator color="#B8FF65" size="large" />
      </View>
    );
  }

  if (trackingQuery.error || !trackingQuery.data) {
    return (
      <View style={styles.loaderShell}>
        <Text style={styles.title}>Tracking link unavailable</Text>
        <Text style={styles.body}>
          {(trackingQuery.error as Error | undefined)?.message ?? "The tracking token is invalid."}
        </Text>
      </View>
    );
  }

  const tracking = trackingQuery.data;

  return (
    <ScrollView style={styles.shell} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Live customer view</Text>
      <Text style={styles.title}>Your driver is now moving through the route</Text>
      <Text style={styles.body}>
        This route refreshes automatically. Once the driver updates location or changes state, the customer site can react without a full page reload.
      </Text>

      <Panel>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Current state</Text>
          <StatusBadge label={tracking.status} />
        </View>

        <RouteStrip
          pickup={tracking.pickup}
          dropoff={tracking.dropoff}
          driverPoint={tracking.driver?.point}
        />

        <View style={styles.driverCard}>
          <Text style={styles.driverLabel}>Driver</Text>
          <Text style={styles.driverName}>
            {tracking.driver?.name ?? "Waiting for a driver to accept"}
          </Text>
          <Text style={styles.driverMeta}>
            {tracking.driver?.vehicleLabel ?? "Assignment pending"}
          </Text>
          {tracking.driver?.updatedAt ? (
            <Text style={styles.driverMeta}>
              Updated {new Date(tracking.driver.updatedAt).toLocaleTimeString()}
            </Text>
          ) : null}
        </View>
      </Panel>

      <Panel>
        <Text style={styles.cardTitle}>Event stream</Text>
        <View style={styles.timeline}>
          {tracking.timeline.map((event) => (
            <View key={`${event.orderId}:${event.happenedAt}:${event.status}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>
                  {event.status.replaceAll("_", " ").toUpperCase()}
                </Text>
                <Text style={styles.timelineMeta}>
                  {new Date(event.happenedAt).toLocaleTimeString()}
                </Text>
                {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </Panel>

      <Text
        style={styles.link}
        onPress={() => void Linking.openURL(tracking.trackingUrl)}
      >
        Open canonical tracking URL
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#A7B1A9",
    fontSize: 15,
    lineHeight: 22,
  },
  cardTitle: {
    color: "#F5F6F1",
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 36,
  },
  driverCard: {
    backgroundColor: "#171E1B",
    borderRadius: 22,
    gap: 4,
    marginTop: 18,
    padding: 16,
  },
  driverLabel: {
    color: "#B8FF65",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  driverMeta: {
    color: "#95A198",
    fontSize: 14,
  },
  driverName: {
    color: "#F5F6F1",
    fontSize: 18,
    fontWeight: "800",
  },
  eyebrow: {
    color: "#B8FF65",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  link: {
    color: "#FFB36E",
    fontSize: 15,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  loaderShell: {
    alignItems: "center",
    backgroundColor: "#101312",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  shell: {
    backgroundColor: "#101312",
    flex: 1,
  },
  timeline: {
    gap: 14,
    marginTop: 18,
  },
  timelineContent: {
    flex: 1,
    gap: 3,
  },
  timelineDot: {
    backgroundColor: "#B8FF65",
    borderRadius: 999,
    height: 10,
    marginTop: 6,
    width: 10,
  },
  timelineMeta: {
    color: "#8F9A91",
    fontSize: 12,
  },
  timelineNote: {
    color: "#DDE4DE",
    fontSize: 13,
    lineHeight: 18,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
  },
  timelineTitle: {
    color: "#F5F6F1",
    fontSize: 14,
    fontWeight: "800",
  },
  title: {
    color: "#F5F6F1",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
});
