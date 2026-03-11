import type { DriverLocationUpdate } from "@drops/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Panel } from "../components/Panel";
import { RouteStrip } from "../components/RouteStrip";
import { StatusBadge } from "../components/StatusBadge";
import { api } from "../lib/api";
import { registerDriverNotifications } from "../lib/notifications";
import { bindWebEventSource } from "../lib/realtime";

const DRIVER_ID = process.env.EXPO_PUBLIC_DRIVER_ID ?? "driver_demo_01";

const nextStatusMap = {
  accepted: "on_the_way",
  on_the_way: "picked_up",
  picked_up: "dropped_off",
} as const;

const metricLabel = (label: string, value: string) => (
  <View style={styles.metricBlock}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

export default function DriverDashboardScreen() {
  const queryClient = useQueryClient();
  const [liveLocationAt, setLiveLocationAt] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["driver-dashboard", DRIVER_ID],
    queryFn: () => api.fetchDriverDashboard(DRIVER_ID),
    refetchInterval: 5_000,
  });

  const availabilityMutation = useMutation({
    mutationFn: (availability: "online" | "offline") =>
      api.setDriverAvailability(DRIVER_ID, availability),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] });
    },
  });

  const offerMutation = useMutation({
    mutationFn: ({ orderId, decision }: { orderId: string; decision: "accept" | "reject" }) =>
      api.respondToOffer(DRIVER_ID, orderId, decision),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "on_the_way" | "picked_up" | "dropped_off" | "cancelled" }) =>
      api.updateOrderStatus(DRIVER_ID, orderId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] });
    },
  });

  const demoOrderMutation = useMutation({
    mutationFn: () => api.createDemoOrder(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] });
    },
  });

  const locationMutation = useMutation({
    mutationFn: (payload: DriverLocationUpdate) =>
      api.updateDriverLocation(DRIVER_ID, payload),
    onSuccess: () => {
      setLiveLocationAt(new Date().toISOString());
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] });
    },
  });

  useEffect(() => {
    void registerDriverNotifications(DRIVER_ID);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    let dispose: () => void = () => {};
    let cancelled = false;

    void api
      .fetchDriverRealtimeCredentials(DRIVER_ID)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void queryClient.invalidateQueries({
            queryKey: ["driver-dashboard", DRIVER_ID],
          });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [queryClient]);

  useEffect(() => {
    const isOnline = dashboardQuery.data?.driver.availability === "online";

    if (!isOnline) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted" || cancelled) {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 7_500,
        },
        (position) => {
          void locationMutation.mutate({
            point: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracyMeters: position.coords.accuracy ?? undefined,
            heading: position.coords.heading ?? undefined,
            speedKph:
              position.coords.speed !== null && position.coords.speed !== undefined
                ? position.coords.speed * 3.6
                : undefined,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [dashboardQuery.data?.driver.availability, locationMutation]);

  const dashboard = dashboardQuery.data;
  const activeAssignment = dashboard?.activeAssignment ?? null;
  const nextStatus =
    activeAssignment ? nextStatusMap[activeAssignment.order.status as keyof typeof nextStatusMap] : null;

  const isRefreshing =
    availabilityMutation.isPending ||
    offerMutation.isPending ||
    statusMutation.isPending ||
    dashboardQuery.isRefetching;

  const trackingOpenLabel = useMemo(() => {
    if (!activeAssignment) {
      return "Public tracking becomes available once an offer is accepted.";
    }

    return activeAssignment.tracking.trackingUrl;
  }, [activeAssignment]);

  if (dashboardQuery.isLoading) {
    return (
      <View style={styles.loaderShell}>
        <ActivityIndicator color="#B8FF65" size="large" />
      </View>
    );
  }

  if (dashboardQuery.error || !dashboard) {
    return (
      <View style={styles.loaderShell}>
        <Text style={styles.errorTitle}>Driver dashboard failed to load</Text>
        <Text style={styles.errorBody}>
          {(dashboardQuery.error as Error | undefined)?.message ?? "Unknown error"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          tintColor="#B8FF65"
          refreshing={isRefreshing}
          onRefresh={() =>
            void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", DRIVER_ID] })
          }
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>Driver Operations</Text>
        <Text style={styles.title}>Dispatch board for {dashboard.driver.name}</Text>
        <Text style={styles.subtitle}>
          Built as a rugged field console first: status clarity, route context, and instant decisioning.
        </Text>
      </View>

      <Panel>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>{dashboard.driver.vehicleLabel}</Text>
            <Text style={styles.sectionMeta}>{dashboard.driver.id}</Text>
          </View>
          <StatusBadge label={dashboard.driver.availability} />
        </View>

        <View style={styles.metricsRow}>
          {metricLabel("Active jobs", String(dashboard.driver.activeOrderCount))}
          {metricLabel(
            "Last GPS",
            liveLocationAt
              ? new Date(liveLocationAt).toLocaleTimeString()
              : dashboard.driver.lastLocationAt
                ? new Date(dashboard.driver.lastLocationAt).toLocaleTimeString()
                : "No fix yet",
          )}
        </View>

        <View style={styles.buttonRow}>
          <ActionButton
            label={dashboard.driver.availability === "online" ? "Go offline" : "Go online"}
            onPress={() =>
              availabilityMutation.mutate(
                dashboard.driver.availability === "online" ? "offline" : "online",
              )
            }
            variant="primary"
          />
          <ActionButton
            label="Dispatch demo order"
            onPress={() => demoOrderMutation.mutate()}
            variant="secondary"
          />
        </View>
      </Panel>

      <Panel>
        <Text style={styles.sectionTitle}>Incoming offers</Text>
        <Text style={styles.sectionMeta}>
          Web push is used for the PWA. Expo push is registered automatically once the native app has an Expo project id.
        </Text>

        {dashboard.offers.length ? (
          <View style={styles.stack}>
            {dashboard.offers.map((offer) => (
              <View key={`${offer.orderId}:${offer.driverId}`} style={styles.offerCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.offerTitle}>Order {offer.orderId}</Text>
                  <Text style={styles.offerMeta}>
                    {offer.pickupDistanceKm.toFixed(1)} km away
                  </Text>
                </View>
                <Text style={styles.offerRoute}>
                  {`${offer.pickup.addressLine} -> ${offer.dropoff.addressLine}`}
                </Text>
                <Text style={styles.offerMeta}>
                  Expires {new Date(offer.expiresAt).toLocaleTimeString()}
                </Text>
                <View style={styles.buttonRow}>
                  <ActionButton
                    label="Accept"
                    onPress={() =>
                      offerMutation.mutate({
                        orderId: offer.orderId,
                        decision: "accept",
                      })
                    }
                    variant="primary"
                  />
                  <ActionButton
                    label="Reject"
                    onPress={() =>
                      offerMutation.mutate({
                        orderId: offer.orderId,
                        decision: "reject",
                      })
                    }
                    variant="ghost"
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyState}>No active offers. Dispatch a demo order or wait for a customer request.</Text>
        )}
      </Panel>

      <Panel>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Active assignment</Text>
          {activeAssignment ? <StatusBadge label={activeAssignment.order.status} /> : null}
        </View>

        {activeAssignment ? (
          <View style={styles.stack}>
            <RouteStrip
              pickup={activeAssignment.order.pickup}
              dropoff={activeAssignment.order.dropoff}
              driverPoint={activeAssignment.tracking.driver?.point}
            />
            <Text style={styles.sectionMeta}>{trackingOpenLabel}</Text>

            <View style={styles.buttonRow}>
              <ActionButton
                label="Navigate to pickup"
                onPress={() => void Linking.openURL(activeAssignment.navigation.toPickup)}
                variant="secondary"
              />
              <ActionButton
                label="Navigate to dropoff"
                onPress={() => void Linking.openURL(activeAssignment.navigation.toDropoff)}
                variant="ghost"
              />
            </View>

            <View style={styles.buttonRow}>
              <ActionButton
                label="Open public tracking"
                onPress={() => void Linking.openURL(activeAssignment.tracking.trackingUrl)}
                variant="secondary"
              />
              {nextStatus ? (
                <ActionButton
                  label={`Mark ${nextStatus.replaceAll("_", " ")}`}
                  onPress={() =>
                    statusMutation.mutate({
                      orderId: activeAssignment.order.id,
                      status: nextStatus,
                    })
                  }
                  variant="primary"
                />
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyState}>
            No accepted order yet. Once an offer is accepted this section becomes the live job cockpit.
          </Text>
        )}
      </Panel>
    </ScrollView>
  );
}

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant: "primary" | "secondary" | "ghost";
};

const ActionButton = ({ label, onPress, variant }: ActionButtonProps) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.button,
      variant === "primary"
        ? styles.buttonPrimary
        : variant === "secondary"
          ? styles.buttonSecondary
          : styles.buttonGhost,
    ]}
  >
    <Text
      style={[
        styles.buttonLabel,
        variant === "primary"
          ? styles.buttonPrimaryLabel
          : variant === "secondary"
            ? styles.buttonSecondaryLabel
            : styles.buttonGhostLabel,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 18,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 14,
  },
  buttonGhost: {
    backgroundColor: "#171E1B",
    borderColor: "#2A332E",
    borderWidth: 1,
  },
  buttonGhostLabel: {
    color: "#D5DED7",
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  buttonPrimary: {
    backgroundColor: "#B8FF65",
  },
  buttonPrimaryLabel: {
    color: "#101312",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  buttonSecondary: {
    backgroundColor: "#FF8C42",
  },
  buttonSecondaryLabel: {
    color: "#16120F",
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 42,
  },
  emptyState: {
    color: "#A7B1A9",
    fontSize: 15,
    lineHeight: 22,
  },
  errorBody: {
    color: "#9FA8A1",
    fontSize: 15,
  },
  errorTitle: {
    color: "#F5F6F1",
    fontSize: 22,
    fontWeight: "700",
  },
  hero: {
    gap: 8,
    paddingBottom: 4,
    paddingTop: 6,
  },
  kicker: {
    color: "#B8FF65",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  loaderShell: {
    alignItems: "center",
    backgroundColor: "#101312",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    padding: 24,
  },
  metricBlock: {
    backgroundColor: "#171E1B",
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  metricLabel: {
    color: "#94A097",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#F5F6F1",
    fontSize: 18,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  offerCard: {
    backgroundColor: "#171E1B",
    borderRadius: 22,
    gap: 12,
    padding: 14,
  },
  offerMeta: {
    color: "#9AA59E",
    fontSize: 13,
  },
  offerRoute: {
    color: "#E4E8E4",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  offerTitle: {
    color: "#F5F6F1",
    fontSize: 16,
    fontWeight: "800",
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionMeta: {
    color: "#95A198",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#F5F6F1",
    fontSize: 22,
    fontWeight: "800",
  },
  shell: {
    backgroundColor: "#101312",
    flex: 1,
  },
  stack: {
    gap: 14,
    marginTop: 18,
  },
  subtitle: {
    color: "#A0ABA3",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 640,
  },
  title: {
    color: "#F5F6F1",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
});
