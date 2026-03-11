import type { DriverDashboard } from "@drops/contracts";
import { useEffect, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import * as Linking from "expo-linking";
import {
  Avatar,
  AvatarFallbackText,
  Box,
  HStack,
  ScrollView,
  Switch,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
import {
  DispatchScreen,
  Eyebrow,
  GlowButton,
  GlowPanel,
  SectionHeader,
  StatusPill,
  palette,
} from "@drops/ui";
import { OfferToast } from "@/components/dispatch/OfferToast";
import { SwipeRail } from "@/components/dispatch/SwipeRail";
import { api } from "@/lib/api";
import {
  buildIdleMap,
  buildOfferMap,
  buildTrackingMarkers,
  formatCountdown,
  formatEta,
} from "@/lib/dispatch-data";
import { registerDriverNotifications } from "@/lib/notifications";
import { bindWebEventSource } from "@/lib/realtime";
import { useSession } from "@/lib/session";

const nextStatusForOrder = (dashboard: DriverDashboard["activeAssignment"]) => {
  const status = dashboard?.order.status;

  if (status === "accepted") {
    return {
      label: "Swipe to head to pickup",
      status: "on_the_way" as const,
      tone: palette.pickup,
    };
  }

  if (status === "on_the_way") {
    return {
      label: "Swipe to start ride",
      status: "picked_up" as const,
      tone: palette.driver,
    };
  }

  if (status === "picked_up") {
    return {
      label: "Swipe to complete dropoff",
      status: "dropped_off" as const,
      tone: palette.dropoff,
    };
  }

  return null;
};

export default function DriverConsoleScreen() {
  const queryClient = useQueryClient();
  const { isLoading, session, sessionToken } = useSession();
  const [toastOfferId, setToastOfferId] = useState<string | null>(null);
  const seenOfferId = useRef<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["driver-dashboard", sessionToken],
    enabled: Boolean(sessionToken) && session?.activeRole === "driver",
    queryFn: () => api.fetchDriverDashboard(sessionToken),
    refetchInterval: 6_000,
  });

  const availabilityMutation = useMutation({
    mutationFn: (nextValue: "online" | "offline") =>
      api.setDriverAvailability(nextValue, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
    },
  });

  const offerDecisionMutation = useMutation({
    mutationFn: ({ orderId, decision }: { orderId: string; decision: "accept" | "reject" }) =>
      api.respondToOffer(orderId, decision, sessionToken),
    onSuccess: (value) => {
      queryClient.setQueryData(["driver-dashboard", sessionToken], value);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: "on_the_way" | "picked_up" | "dropped_off" }) =>
      api.updateOrderStatus(orderId, status, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
    },
  });

  const locationMutation = useMutation({
    mutationFn: (point: {
      point: { latitude: number; longitude: number };
      accuracyMeters?: number;
      heading?: number;
      speedKph?: number;
    }) => api.updateDriverLocation(point, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
    },
  });

  useEffect(() => {
    if (!sessionToken || session?.activeRole !== "driver") {
      return;
    }

    void registerDriverNotifications(sessionToken);
  }, [session?.activeRole, sessionToken]);

  useEffect(() => {
    if (!sessionToken || session?.activeRole !== "driver") {
      return;
    }

    let dispose: () => void = () => undefined;
    let cancelled = false;

    void api
      .fetchDriverRealtimeCredentials(sessionToken)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [queryClient, session?.activeRole, sessionToken]);

  useEffect(() => {
    const driver = dashboardQuery.data?.driver;

    if (!driver || driver.availability !== "online") {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled || permission.status !== "granted") {
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 30,
          timeInterval: 6_000,
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
              position.coords.speed === null || position.coords.speed === undefined
                ? undefined
                : position.coords.speed * 3.6,
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [dashboardQuery.data?.driver?.availability, sessionToken]);

  useEffect(() => {
    const topOffer = dashboardQuery.data?.offers.find((offer) => offer.status === "pending");

    if (!topOffer || seenOfferId.current === topOffer.orderId) {
      return;
    }

    seenOfferId.current = topOffer.orderId;
    setToastOfferId(topOffer.orderId);
    const timeout = setTimeout(() => setToastOfferId(null), 5_000);
    return () => clearTimeout(timeout);
  }, [dashboardQuery.data?.offers]);

  if (!isLoading && !session) {
    return <Redirect href="/sign-in?next=/driver" />;
  }

  if (!isLoading && session?.activeRole !== "driver") {
    return <Redirect href="/settings" />;
  }

  if (isLoading || !session || dashboardQuery.isLoading || !dashboardQuery.data) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color={palette.textMuted}>Loading driver console...</Text>
        </VStack>
      </DispatchScreen>
    );
  }

  const dashboard = dashboardQuery.data;
  const topOffer = dashboard.offers.find((offer) => offer.status === "pending") ?? null;
  const activeAssignment = dashboard.activeAssignment;
  const nextStatus = nextStatusForOrder(activeAssignment);
  const activeMap = activeAssignment
    ? activeAssignment.tracking.map
    : topOffer
      ? buildOfferMap(topOffer)
      : buildIdleMap(dashboard.driver.lastKnownLocation);
  const activeMarkers = activeAssignment
    ? buildTrackingMarkers(activeAssignment.tracking)
    : topOffer
      ? [
          {
            stop: {
              kind: "pickup" as const,
              label: "Pickup",
              point: topOffer.pickup.point,
            },
            emphasized: true,
          },
          {
            stop: {
              kind: "dropoff" as const,
              label: "Dropoff",
              point: topOffer.dropoff.point,
            },
          },
        ]
      : dashboard.driver.lastKnownLocation
        ? [
            {
              stop: {
                kind: "driver" as const,
                label: dashboard.driver.name,
                point: dashboard.driver.lastKnownLocation,
              },
              emphasized: true,
            },
          ]
        : undefined;

  const activeNavigationUrl =
    activeAssignment?.order.status === "picked_up"
      ? activeAssignment.navigation.toDropoff
      : activeAssignment?.navigation.toPickup;

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 42 }}>
        <Box style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <OfferToast
            offer={topOffer}
            visible={Boolean(topOffer && toastOfferId === topOffer.orderId)}
          />
          <NightCityMap
            map={activeMap}
            title={activeAssignment ? "Active task" : topOffer ? "Incoming offer" : "City queue"}
            subtitle={
              activeAssignment
                ? "The primary stop stays bright. Tap it to launch navigation."
                : topOffer
                  ? "Pickup and dropoff are already plotted for a fast decision."
                  : "Stay online and the board will surface the next best run."
            }
            markers={activeMarkers}
            height={520}
            onPrimaryPress={
              activeNavigationUrl ? () => void Linking.openURL(activeNavigationUrl) : undefined
            }
          >
            <Box position="absolute" bottom={20} left={20} right={20}>
              <GlowPanel tone={activeAssignment ? "driver" : topOffer ? "pickup" : "default"}>
                <SectionHeader
                  title={dashboard.driver.name}
                  detail={dashboard.driver.vehicleLabel}
                  right={
                    <HStack alignItems="center" gap="$2">
                      <StatusPill
                        label={dashboard.driver.availability}
                        tone={dashboard.driver.availability === "online" ? "pickup" : "warning"}
                      />
                      <Switch
                        value={dashboard.driver.availability === "online"}
                        onValueChange={(value) =>
                          availabilityMutation.mutate(value ? "online" : "offline")
                        }
                      />
                    </HStack>
                  }
                />

                {activeAssignment ? (
                  <VStack gap="$4" style={{ marginTop: 16 }}>
                    <HStack alignItems="center" gap="$3">
                      <Avatar size="md" style={{ backgroundColor: "#1B2239" }}>
                        <AvatarFallbackText>
                          {activeAssignment.order.customerName}
                        </AvatarFallbackText>
                      </Avatar>
                      <VStack flex={1} gap="$1">
                        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                          {activeAssignment.order.customerName}
                        </Text>
                        <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                          {activeAssignment.order.status.replaceAll("_", " ")}
                        </Text>
                      </VStack>
                      <StatusPill
                        label={formatEta(activeAssignment.tracking.map.etaMinutes)}
                        tone="driver"
                      />
                    </HStack>

                    <GlowButton
                      tone={activeAssignment.order.status === "picked_up" ? "secondary" : "primary"}
                      onPress={() =>
                        activeNavigationUrl ? void Linking.openURL(activeNavigationUrl) : undefined
                      }
                    >
                      {activeAssignment.order.status === "picked_up"
                        ? "Open navigation to dropoff"
                        : "Open navigation to pickup"}
                    </GlowButton>

                    {nextStatus ? (
                      <SwipeRail
                        label={nextStatus.label}
                        accent={nextStatus.tone}
                        isLoading={statusMutation.isPending}
                        onComplete={() =>
                          statusMutation.mutate({
                            orderId: activeAssignment.order.id,
                            status: nextStatus.status,
                          })
                        }
                      />
                    ) : null}
                  </VStack>
                ) : topOffer ? (
                  <VStack gap="$4" style={{ marginTop: 16 }}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1} gap="$1">
                        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                          {topOffer.pickup.addressLine}
                        </Text>
                        <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                          Drop at {topOffer.dropoff.addressLine}
                        </Text>
                      </VStack>
                      <StatusPill label={formatCountdown(topOffer.expiresAt)} tone="warning" />
                    </HStack>
                    <HStack gap="$3">
                      <GlowButton
                        onPress={() =>
                          offerDecisionMutation.mutate({
                            orderId: topOffer.orderId,
                            decision: "accept",
                          })
                        }
                        isLoading={offerDecisionMutation.isPending}
                      >
                        Accept order
                      </GlowButton>
                      <GlowButton
                        tone="secondary"
                        variant="outline"
                        onPress={() =>
                          offerDecisionMutation.mutate({
                            orderId: topOffer.orderId,
                            decision: "reject",
                          })
                        }
                      >
                        Reject
                      </GlowButton>
                    </HStack>
                  </VStack>
                ) : (
                  <VStack gap="$2" style={{ marginTop: 16 }}>
                    <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                      {dashboard.driver.availability === "online"
                        ? "Online and listening for the next run."
                        : "Go online to receive orders."}
                    </Text>
                    <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                      Active jobs: {dashboard.driver.activeOrderCount}. Last location update:{" "}
                      {dashboard.driver.lastLocationAt
                        ? new Date(dashboard.driver.lastLocationAt).toLocaleTimeString()
                        : "not sent yet"}
                    </Text>
                  </VStack>
                )}
              </GlowPanel>
            </Box>
          </NightCityMap>
        </Box>

        <Box style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <GlowPanel>
            <SectionHeader
              title="Operational state"
              detail="Customer tracking and allocation both listen to this live console."
            />
            <HStack gap="$5" flexWrap="wrap" style={{ marginTop: 16 }}>
              <VStack gap="$1">
                <Text style={{ color: palette.textMuted, fontSize: 12, letterSpacing: 2 }}>
                  ACTIVE ORDERS
                </Text>
                <Text style={{ color: palette.text, fontSize: 24, fontWeight: "700" }}>
                  {dashboard.driver.activeOrderCount}
                </Text>
              </VStack>
              <VStack gap="$1">
                <Text style={{ color: palette.textMuted, fontSize: 12, letterSpacing: 2 }}>
                  LAST GPS
                </Text>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                  {dashboard.driver.lastLocationAt
                    ? new Date(dashboard.driver.lastLocationAt).toLocaleTimeString()
                    : "No fix yet"}
                </Text>
              </VStack>
            </HStack>
          </GlowPanel>

          <GlowButton tone="ghost" variant="outline" onPress={() => router.push("/settings")}>
            Open account and role settings
          </GlowButton>
        </Box>
      </ScrollView>
    </DispatchScreen>
  );
}
