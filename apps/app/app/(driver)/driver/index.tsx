import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Box, HStack, ScrollView, Text, VStack } from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
import { SwipeRail } from "@/components/dispatch/SwipeRail";
import { OfferToast } from "@/components/dispatch/OfferToast";
import { OrderTimeline } from "@/components/dispatch/OrderTimeline";
import { api } from "@/lib/api";
import {
  buildOfferMap,
  buildIdleMap,
  buildTrackingMarkers,
  formatCountdown,
  formatEta,
  orderStatusCopy,
} from "@/lib/dispatch-data";
import { bindWebEventSource } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import {
  DispatchScreen,
  Eyebrow,
  GlowButton,
  GlowPanel,
  HeroTitle,
  MetricRow,
  SectionHeader,
  StatusPill,
  SupportingText,
  palette,
} from "@drops/ui";

const nextActionForStatus = (
  status: "accepted" | "on_the_way" | "picked_up",
) => {
  if (status === "accepted") {
    return {
      label: "Swipe to head to pickup",
      nextStatus: "on_the_way" as const,
      accent: palette.pickup,
    };
  }

  if (status === "on_the_way") {
    return {
      label: "Swipe to confirm pickup",
      nextStatus: "picked_up" as const,
      accent: palette.pickup,
    };
  }

  return {
    label: "Swipe to complete ride",
    nextStatus: "dropped_off" as const,
    accent: palette.dropoff,
  };
};

export default function DriverScreen() {
  const queryClient = useQueryClient();
  const { isLoading, session, sessionToken, switchRole } = useSession();
  const [toastVisible, setToastVisible] = useState(false);
  const lastToastOrderId = useRef<string | null>(null);
  const lastLocationUpdateAt = useRef(0);

  const driverDashboardQuery = useQuery({
    queryKey: ["driver-dashboard", sessionToken],
    enabled: Boolean(sessionToken) && session?.activeRole === "driver",
    queryFn: () => api.fetchDriverDashboard(sessionToken),
    refetchInterval: 5_000,
  });

  const availabilityMutation = useMutation({
    mutationFn: (availability: "online" | "offline") =>
      api.setDriverAvailability(availability, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
    },
  });

  const offerDecisionMutation = useMutation({
    mutationFn: (decision: "accept" | "reject") =>
      api.respondToOffer(pendingOffer!.orderId, decision, sessionToken),
    onSuccess: (value) => {
      queryClient.setQueryData(["driver-dashboard", sessionToken], value);
      void queryClient.invalidateQueries({ queryKey: ["customer-order"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: "on_the_way" | "picked_up" | "dropped_off") =>
      api.updateOrderStatus(activeAssignment!.order.id, status, sessionToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["driver-dashboard", sessionToken] });
      void queryClient.invalidateQueries({ queryKey: ["customer-order"] });
    },
  });

  const dashboard = driverDashboardQuery.data ?? null;
  const pendingOffer = dashboard?.offers.find((offer) => offer.status === "pending") ?? null;
  const activeAssignment = dashboard?.activeAssignment ?? null;
  const activeMap = activeAssignment?.tracking.map
    ?? (pendingOffer ? buildOfferMap(pendingOffer) : buildIdleMap(dashboard?.driver.lastKnownLocation));
  const activeMarkers: Array<{
    stop: {
      kind: "pickup" | "dropoff" | "driver";
      label: string;
      point: { latitude: number; longitude: number };
    };
    emphasized?: boolean;
  }> = activeAssignment
    ? buildTrackingMarkers(activeAssignment.tracking)
    : pendingOffer
      ? [
          {
            stop: {
              kind: "pickup" as const,
              label: "Pickup",
              point: pendingOffer.pickup.point,
            },
            emphasized: true,
          },
          {
            stop: {
              kind: "dropoff" as const,
              label: "Dropoff",
              point: pendingOffer.dropoff.point,
            },
          },
          ...(dashboard?.driver.lastKnownLocation
            ? [
                {
                  stop: {
                    kind: "driver" as const,
                    label: dashboard.driver.name,
                    point: dashboard.driver.lastKnownLocation,
                  },
                },
              ]
            : []),
        ]
    : dashboard?.driver.lastKnownLocation
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
      : [];
  const activeAction =
    activeAssignment &&
    activeAssignment.order.status !== "dropped_off" &&
    activeAssignment.order.status !== "cancelled"
      ? nextActionForStatus(
          activeAssignment.order.status as "accepted" | "on_the_way" | "picked_up",
        )
      : null;
  const activeNavigationUrl =
    activeAssignment?.order.status === "picked_up"
      ? activeAssignment.navigation.toDropoff
      : activeAssignment?.navigation.toPickup;

  useEffect(() => {
    const orderId = pendingOffer?.orderId ?? null;

    if (!orderId || lastToastOrderId.current === orderId) {
      return;
    }

    lastToastOrderId.current = orderId;
    setToastVisible(true);
    const timeout = setTimeout(() => setToastVisible(false), 4_800);

    return () => clearTimeout(timeout);
  }, [pendingOffer?.orderId]);

  useEffect(() => {
    if (!sessionToken || session?.activeRole !== "driver") {
      return;
    }

    let cancelled = false;
    let dispose: () => void = () => undefined;

    void api
      .fetchDriverRealtimeCredentials(sessionToken)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void driverDashboardQuery.refetch();
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [driverDashboardQuery.refetch, session?.activeRole, sessionToken]);

  useEffect(() => {
    if (
      session?.activeRole !== "driver" ||
      dashboard?.driver.availability !== "online" ||
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastLocationUpdateAt.current < 12_000) {
          return;
        }

        lastLocationUpdateAt.current = Date.now();

        void api.updateDriverLocation(
          {
            point: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracyMeters: position.coords.accuracy,
            heading:
              typeof position.coords.heading === "number" && position.coords.heading >= 0
                ? position.coords.heading
                : undefined,
            speedKph:
              typeof position.coords.speed === "number" && position.coords.speed >= 0
                ? position.coords.speed * 3.6
                : undefined,
          },
          sessionToken,
        ).catch(() => undefined);
      },
      () => undefined,
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [dashboard?.driver.availability, session?.activeRole, sessionToken]);

  const hudCopy = useMemo(() => {
    if (activeAssignment) {
      return orderStatusCopy[activeAssignment.order.status];
    }

    if (pendingOffer) {
      return {
        label: "Incoming offer on deck",
        detail: "Pickup and dropoff are visible under the toast so the route is obvious before you answer.",
      };
    }

    return {
      label: "Idle city watch",
      detail: "Stay online to receive the next nearby order assignment.",
    };
  }, [activeAssignment, pendingOffer]);

  if (!isLoading && !session) {
    return <Redirect href={{ pathname: "/sign-in", params: { next: "/driver" } }} />;
  }

  if (isLoading || !session) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color={palette.textMuted}>Loading driver operations...</Text>
        </VStack>
      </DispatchScreen>
    );
  }

  if (!session.availableRoles.includes("driver")) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" gap="$4">
          <GlowPanel tone="driver">
            <SectionHeader
              title="Driver role is invite-only"
              detail="This account is not linked to an approved driver record yet."
            />
            <Text style={{ color: palette.textMuted, fontSize: 15, marginTop: 16 }}>
              Customer access is active, but the driver map only unlocks after an admin invitation has been approved.
            </Text>
          </GlowPanel>
        </VStack>
      </DispatchScreen>
    );
  }

  if (session.activeRole !== "driver") {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" gap="$4">
          <GlowPanel tone="driver">
            <SectionHeader
              title="Driver role is available"
              detail="Switch the active role and the app will route you straight into the city operations surface."
            />
            <Box style={{ marginTop: 18 }}>
              <GlowButton onPress={() => void switchRole("driver")}>
                Switch to driver
              </GlowButton>
            </Box>
          </GlowPanel>
        </VStack>
      </DispatchScreen>
    );
  }

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <LinearGradient
          colors={["#07111A", "#040711", "#130A1A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 26 }}
        >
          <VStack gap="$5">
            <VStack gap="$3">
              <Eyebrow>Driver Operations</Eyebrow>
              <HeroTitle>City map first. Offer sheet second. No dashboard wall between the driver and the route.</HeroTitle>
              <SupportingText>
                The live SaaSignal-backed dispatch payload drives this HUD, the active stop, and the trip progression controls.
              </SupportingText>
            </VStack>

            <Box style={{ position: "relative" }}>
              <NightCityMap
                map={activeMap}
                title={hudCopy.label}
                subtitle={hudCopy.detail}
                markers={activeMarkers}
                height={460}
              />
              <OfferToast offer={pendingOffer} visible={toastVisible} />
            </Box>

            <HStack gap="$5" flexWrap="wrap">
              <MetricRow label="Driver" value={dashboard?.driver.name ?? "Loading"} />
              <MetricRow
                label="Availability"
                value={dashboard?.driver.availability ?? "offline"}
              />
              <MetricRow label="Live ETA" value={formatEta(activeMap.etaMinutes)} />
            </HStack>

            <HStack gap="$3" flexWrap="wrap">
              <GlowButton
                onPress={() =>
                  availabilityMutation.mutate(
                    dashboard?.driver.availability === "online" ? "offline" : "online",
                  )
                }
                isLoading={availabilityMutation.isPending}
              >
                {dashboard?.driver.availability === "online" ? "Go offline" : "Go online"}
              </GlowButton>
              {activeNavigationUrl ? (
                <GlowButton
                  tone="secondary"
                  variant="outline"
                  onPress={() => void Linking.openURL(activeNavigationUrl)}
                >
                  Open active stop
                </GlowButton>
              ) : null}
            </HStack>
          </VStack>
        </LinearGradient>

        <VStack gap="$4" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {pendingOffer ? (
            <GlowPanel tone="pickup">
              <SectionHeader
                title="Incoming order"
                detail="The background map already shows pickup and dropoff. Decide before the countdown expires."
                right={<StatusPill label={formatCountdown(pendingOffer.expiresAt)} tone="warning" />}
              />
              <VStack gap="$4" style={{ marginTop: 18 }}>
                <VStack gap="$1">
                  <Text style={{ color: palette.pickup, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Pickup
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                    {pendingOffer.pickup.addressLine}
                  </Text>
                </VStack>
                <VStack gap="$1">
                  <Text style={{ color: palette.dropoff, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Dropoff
                  </Text>
                  <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                    {pendingOffer.dropoff.addressLine}
                  </Text>
                </VStack>
                <HStack gap="$5" flexWrap="wrap">
                  <MetricRow
                    label="Pickup distance"
                    value={`${pendingOffer.pickupDistanceKm.toFixed(1)} km`}
                  />
                  <MetricRow label="Score" value={pendingOffer.score.toFixed(0)} />
                  <MetricRow label="Queue" value={`${dashboard?.driver.activeOrderCount ?? 0}`} />
                </HStack>
                <HStack gap="$3" flexWrap="wrap">
                  <GlowButton
                    onPress={() => offerDecisionMutation.mutate("accept")}
                    isLoading={offerDecisionMutation.isPending}
                  >
                    Accept order
                  </GlowButton>
                  <GlowButton
                    tone="secondary"
                    variant="outline"
                    onPress={() => offerDecisionMutation.mutate("reject")}
                    isLoading={offerDecisionMutation.isPending}
                  >
                    Reject
                  </GlowButton>
                </HStack>
              </VStack>
            </GlowPanel>
          ) : null}

          {activeAssignment ? (
            <>
              <GlowPanel tone="driver">
                <SectionHeader
                  title="Active task"
                  detail="The dominant stop and swipe rail both follow the order state."
                  right={
                    <StatusPill
                      label={activeAssignment.order.status.replaceAll("_", " ")}
                      tone={activeAssignment.order.status === "picked_up" ? "dropoff" : "driver"}
                    />
                  }
                />
                <VStack gap="$4" style={{ marginTop: 18 }}>
                  <VStack gap="$1">
                    <Text style={{ color: palette.driver, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                      Active stop
                    </Text>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                      {activeAssignment.tracking.map.primaryStop?.label === "Dropoff"
                        ? activeAssignment.order.dropoff.addressLine
                        : activeAssignment.order.pickup.addressLine}
                    </Text>
                    <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                      {activeAssignment.tracking.map.activeLeg === "to_dropoff"
                        ? "Dropoff is dominant after pickup."
                        : "Pickup stays dominant until the rider is onboard."}
                    </Text>
                  </VStack>
                  <HStack gap="$5" flexWrap="wrap">
                    <MetricRow label="Order" value={activeAssignment.order.id.slice(-8)} />
                    <MetricRow label="ETA" value={formatEta(activeAssignment.tracking.map.etaMinutes)} />
                    <MetricRow
                      label="Leg"
                      value={activeAssignment.tracking.map.activeLeg.replaceAll("_", " ")}
                    />
                  </HStack>
                  {activeAction ? (
                    <SwipeRail
                      label={activeAction.label}
                      accent={activeAction.accent}
                      isLoading={statusMutation.isPending}
                      onComplete={() => statusMutation.mutate(activeAction.nextStatus)}
                    />
                  ) : null}
                </VStack>
              </GlowPanel>

              <GlowPanel>
                <SectionHeader
                  title="Trip timeline"
                  detail="Status progression is visible for both operator review and customer tracking."
                />
                <Box style={{ marginTop: 16 }}>
                  <OrderTimeline events={activeAssignment.tracking.timeline} />
                </Box>
              </GlowPanel>
            </>
          ) : null}

          {!pendingOffer && !activeAssignment ? (
            <GlowPanel tone="dropoff">
              <SectionHeader
                title="Idle city watch"
                detail="Stay online and keep location sharing enabled so the next nearby request can land here immediately."
              />
              {driverDashboardQuery.error ? (
                <Text style={{ color: palette.dropoff, marginTop: 16 }}>
                  {driverDashboardQuery.error.message}
                </Text>
              ) : null}
            </GlowPanel>
          ) : null}
        </VStack>
      </ScrollView>
    </DispatchScreen>
  );
}
