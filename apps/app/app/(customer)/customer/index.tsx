import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import {
  Avatar,
  AvatarFallbackText,
  Box,
  HStack,
  Input,
  InputField,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
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
  TapCard,
  palette,
} from "@drops/ui";
import { OrderTimeline } from "@/components/dispatch/OrderTimeline";
import { api } from "@/lib/api";
import { bindWebEventSource } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import {
  buildPairMap,
  buildTrackingMarkers,
  buildComposerOrderInput,
  formatEta,
  locationPresets,
  orderStatusCopy,
  searchLocations,
  toAddressPoint,
} from "@/lib/dispatch-data";

const LocationPicker = ({
  title,
  query,
  selectedId,
  onChangeQuery,
  onSelect,
}: {
  title: string;
  query: string;
  selectedId: string;
  onChangeQuery: (value: string) => void;
  onSelect: (location: (typeof locationPresets)[number]) => void;
}) => {
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(() => searchLocations(deferredQuery), [deferredQuery]);

  return (
    <GlowPanel>
      <SectionHeader
        title={title}
        detail="Search from the current launch stops while the SaaSignal-backed web map stays centered on the route."
      />
      <VStack gap="$3" style={{ marginTop: 18 }}>
        <Input
          style={{
            backgroundColor: "rgba(10, 15, 32, 0.86)",
            borderColor: palette.border,
          }}
        >
          <InputField
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Type Nyhavn, Tivoli, Opera..."
            color={palette.text}
            placeholderTextColor={palette.textMuted}
          />
        </Input>
        <VStack gap="$3">
          {matches.slice(0, 4).map((location) => {
            const isSelected = location.id === selectedId;

            return (
              <TapCard key={location.id} onPress={() => onSelect(location)}>
                <HStack justifyContent="space-between" alignItems="center" gap="$4">
                  <VStack flex={1} gap="$1">
                    <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                      {location.label}
                    </Text>
                    <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                      {location.addressLine}
                    </Text>
                  </VStack>
                  {isSelected ? <StatusPill label="Selected" tone="pickup" /> : null}
                </HStack>
              </TapCard>
            );
          })}
        </VStack>
      </VStack>
    </GlowPanel>
  );
};

export default function CustomerScreen() {
  const queryClient = useQueryClient();
  const { isLoading, session, sessionToken, switchRole } = useSession();
  const [pickupQuery, setPickupQuery] = useState(locationPresets[0]!.label);
  const [dropoffQuery, setDropoffQuery] = useState(locationPresets[3]!.label);
  const [selectedPickup, setSelectedPickup] = useState(locationPresets[0]!);
  const [selectedDropoff, setSelectedDropoff] = useState(locationPresets[3]!);
  const [customerName, setCustomerName] = useState("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!customerName && session?.user.name) {
      setCustomerName(session.user.name);
    }
  }, [customerName, session?.user.name]);

  const currentOrderQuery = useQuery({
    queryKey: ["customer-order", sessionToken],
    enabled: Boolean(sessionToken) && session?.activeRole === "customer",
    queryFn: () => api.fetchCurrentCustomerOrder(sessionToken),
    refetchInterval: 8_000,
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.createCustomerOrder(
        buildComposerOrderInput({
          customerName: customerName.trim() || session?.user.name || "Customer",
          customerPhoneNumber,
          notes,
          priority: "normal",
          pickup: selectedPickup,
          dropoff: selectedDropoff,
        }),
        sessionToken,
      ),
    onSuccess: (value) => {
      queryClient.setQueryData(["customer-order", sessionToken], value);
    },
  });

  const activeOrder = currentOrderQuery.data ?? createOrderMutation.data ?? null;
  const statusCopy = activeOrder ? orderStatusCopy[activeOrder.order.status] : null;
  const composerMap = buildPairMap(
    toAddressPoint(selectedPickup),
    toAddressPoint(selectedDropoff),
  );

  useEffect(() => {
    const trackingToken = activeOrder?.order.trackingToken;

    if (!trackingToken) {
      return;
    }

    let cancelled = false;
    let dispose: () => void = () => undefined;

    void api
      .fetchTrackingRealtimeCredentials(trackingToken)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void currentOrderQuery.refetch();
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [activeOrder?.order.trackingToken, currentOrderQuery.refetch]);

  if (!isLoading && !session) {
    return <Redirect href={{ pathname: "/sign-in", params: { next: "/customer" } }} />;
  }

  if (isLoading || !session) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color={palette.textMuted}>Loading customer dispatch...</Text>
        </VStack>
      </DispatchScreen>
    );
  }

  if (session.activeRole !== "customer") {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" gap="$4">
          <GlowPanel tone="pickup">
            <SectionHeader
              title="Customer mode is not active"
              detail="This account can order, but the active role needs to switch back to customer."
            />
            <Box style={{ marginTop: 18 }}>
              <GlowButton onPress={() => void switchRole("customer")}>
                Switch to customer
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
          colors={["#040711", "#08111E", "#0F1B2D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 26 }}
        >
          <VStack gap="$5">
            <VStack gap="$3">
              <Eyebrow>Customer Dispatch</Eyebrow>
              <HeroTitle>
                {activeOrder
                  ? "The live run stays on this map until the order closes."
                  : "Set pickup and dropoff first. The city map frames the route before you send it."}
              </HeroTitle>
              <SupportingText>
                {activeOrder
                  ? "Waiting, assignment, and live tracking all stay inside the same surface so the customer never loses context."
                  : "This is a customer-first map composer. Sign-in unlocks request creation and public tracking sharing without leaving the app shell."}
              </SupportingText>
            </VStack>

            <NightCityMap
              map={activeOrder?.tracking.map ?? composerMap}
              title={activeOrder ? statusCopy?.label : "Order composer"}
              subtitle={
                activeOrder
                  ? statusCopy?.detail
                  : "Pickup and dropoff markers stay bright while the route overlay previews the active leg."
              }
              markers={activeOrder ? buildTrackingMarkers(activeOrder.tracking) : undefined}
              height={460}
            />

            <HStack gap="$5" flexWrap="wrap">
              <MetricRow
                label="Role"
                value={session.activeRole}
              />
              <MetricRow
                label={activeOrder ? "ETA" : "Draft ETA"}
                value={formatEta((activeOrder?.tracking.map ?? composerMap).etaMinutes)}
              />
              <MetricRow
                label={activeOrder ? "Status" : "Route"}
                value={
                  activeOrder
                    ? activeOrder.order.status.replaceAll("_", " ")
                    : `${selectedPickup.label} → ${selectedDropoff.label}`
                }
              />
            </HStack>
          </VStack>
        </LinearGradient>

        <VStack gap="$4" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {activeOrder ? (
            <>
              <GlowPanel tone="driver">
                <SectionHeader
                  title="Live order state"
                  detail="Dispatch updates this panel as the driver accepts, travels to pickup, and completes the route."
                  right={
                    <StatusPill
                      label={activeOrder.order.status.replaceAll("_", " ")}
                      tone={
                        activeOrder.order.status === "picked_up"
                          ? "dropoff"
                          : activeOrder.order.status === "accepted" ||
                              activeOrder.order.status === "on_the_way"
                            ? "driver"
                            : "pickup"
                      }
                    />
                  }
                />
                <HStack gap="$4" alignItems="center" style={{ marginTop: 18 }}>
                  <Avatar size="md" style={{ backgroundColor: "#1B2239" }}>
                    <AvatarFallbackText>
                      {activeOrder.tracking.driver?.name ?? "Queue"}
                    </AvatarFallbackText>
                  </Avatar>
                  <VStack flex={1} gap="$1">
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                      {activeOrder.tracking.driver?.name ?? "Dispatch matching"}
                    </Text>
                    <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                      {activeOrder.tracking.driver?.vehicleLabel ??
                        "A qualified nearby driver will appear here once the offer is accepted."}
                    </Text>
                    <Text style={{ color: palette.driver, fontSize: 14, fontWeight: "700" }}>
                      ETA {formatEta(activeOrder.tracking.map.etaMinutes)}
                    </Text>
                  </VStack>
                </HStack>
                <HStack gap="$3" flexWrap="wrap" style={{ marginTop: 18 }}>
                  <GlowButton onPress={() => void Linking.openURL(activeOrder.shareUrl)}>
                    Open public tracker
                  </GlowButton>
                  <GlowButton
                    tone="secondary"
                    variant="outline"
                    onPress={() => void currentOrderQuery.refetch()}
                  >
                    Refresh order
                  </GlowButton>
                </HStack>
              </GlowPanel>

              <GlowPanel>
                <SectionHeader
                  title="Route timeline"
                  detail="Every state transition lands here in timestamp order."
                />
                <Box style={{ marginTop: 16 }}>
                  <OrderTimeline events={activeOrder.tracking.timeline} />
                </Box>
              </GlowPanel>

              <GlowPanel tone="pickup">
                <SectionHeader
                  title="Stops"
                  detail="The dominant stop and route leg come directly from the tracking payload."
                />
                <VStack gap="$4" style={{ marginTop: 16 }}>
                  <VStack gap="$1">
                    <Text style={{ color: palette.pickup, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                      Pickup
                    </Text>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                      {activeOrder.order.pickup.addressLine}
                    </Text>
                  </VStack>
                  <VStack gap="$1">
                    <Text style={{ color: palette.dropoff, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                      Dropoff
                    </Text>
                    <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                      {activeOrder.order.dropoff.addressLine}
                    </Text>
                  </VStack>
                </VStack>
              </GlowPanel>
            </>
          ) : (
            <>
              <LocationPicker
                title="Pickup location"
                query={pickupQuery}
                selectedId={selectedPickup.id}
                onChangeQuery={setPickupQuery}
                onSelect={(location) => {
                  setSelectedPickup(location);
                  setPickupQuery(location.label);
                }}
              />

              <LocationPicker
                title="Dropoff location"
                query={dropoffQuery}
                selectedId={selectedDropoff.id}
                onChangeQuery={setDropoffQuery}
                onSelect={(location) => {
                  setSelectedDropoff(location);
                  setDropoffQuery(location.label);
                }}
              />

              <GlowPanel tone="driver">
                <SectionHeader
                  title="Customer details"
                  detail="This sheet stays tight: name, phone, notes, then dispatch."
                />
                <VStack gap="$3" style={{ marginTop: 18 }}>
                  <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                    <InputField
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="Customer name"
                      color={palette.text}
                      placeholderTextColor={palette.textMuted}
                    />
                  </Input>
                  <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                    <InputField
                      value={customerPhoneNumber}
                      onChangeText={setCustomerPhoneNumber}
                      keyboardType="phone-pad"
                      placeholder="Phone number"
                      color={palette.text}
                      placeholderTextColor={palette.textMuted}
                    />
                  </Input>
                  <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                    <InputField
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Door code, pickup notes, building instructions..."
                      color={palette.text}
                      placeholderTextColor={palette.textMuted}
                    />
                  </Input>
                </VStack>
                <Box style={{ marginTop: 20 }}>
                  <GlowButton
                    onPress={() => createOrderMutation.mutate()}
                    isLoading={createOrderMutation.isPending}
                  >
                    Send order into dispatch
                  </GlowButton>
                </Box>
                {createOrderMutation.error ? (
                  <Text style={{ color: palette.dropoff, marginTop: 16 }}>
                    {createOrderMutation.error.message}
                  </Text>
                ) : null}
              </GlowPanel>
            </>
          )}
        </VStack>
      </ScrollView>
    </DispatchScreen>
  );
}
