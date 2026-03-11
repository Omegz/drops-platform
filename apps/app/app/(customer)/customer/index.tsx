import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  HStack,
  Input,
  InputField,
  ScrollView,
  Text,
  Textarea,
  TextareaInput,
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
  SupportingText,
  TapCard,
  palette,
} from "@drops/ui";
import { TrackingScene } from "@/components/dispatch/TrackingScene";
import { api } from "@/lib/api";
import {
  buildComposerOrderInput,
  buildPairMap,
  formatEta,
  locationPresets,
  orderStatusCopy,
  previewMap,
  searchLocations,
  toAddressPoint,
} from "@/lib/dispatch-data";
import { bindWebEventSource } from "@/lib/realtime";
import { useSession } from "@/lib/session";

const priorityModes = [
  {
    value: "normal" as const,
    label: "Normal",
    detail: "Balanced dispatch across distance and current load.",
  },
  {
    value: "priority" as const,
    label: "Priority",
    detail: "Bias closer drivers harder when you need a faster pickup.",
  },
];

const LocationPicker = ({
  title,
  value,
  onChangeText,
  matches,
  selectedId,
  onSelect,
}: {
  title: string;
  value: string;
  onChangeText: (value: string) => void;
  matches: typeof locationPresets;
  selectedId: string | null;
  onSelect: (location: (typeof locationPresets)[number]) => void;
}) => (
  <GlowPanel>
    <SectionHeader title={title} detail="Search a curated city stop list for the first release." />
    <VStack gap="$3" style={{ marginTop: 16 }}>
      <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
        <InputField
          value={value}
          onChangeText={onChangeText}
          placeholder="Type Nyhavn, Tivoli, Opera..."
          color={palette.text}
          placeholderTextColor={palette.textMuted}
        />
      </Input>
      <VStack gap="$3">
        {matches.slice(0, 4).map((location) => (
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
              {selectedId === location.id ? (
                <StatusPill label="Selected" tone="pickup" />
              ) : null}
            </HStack>
          </TapCard>
        ))}
      </VStack>
    </VStack>
  </GlowPanel>
);

export default function CustomerHomeScreen() {
  const queryClient = useQueryClient();
  const { isLoading, session, sessionToken } = useSession();
  const [customerName, setCustomerName] = useState("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"normal" | "priority">("normal");
  const [pickupQuery, setPickupQuery] = useState(locationPresets[0]!.label);
  const [dropoffQuery, setDropoffQuery] = useState(locationPresets[3]!.label);
  const [selectedPickup, setSelectedPickup] = useState(locationPresets[0]!);
  const [selectedDropoff, setSelectedDropoff] = useState(locationPresets[3]!);

  const deferredPickupQuery = useDeferredValue(pickupQuery);
  const deferredDropoffQuery = useDeferredValue(dropoffQuery);
  const pickupMatches = useMemo(
    () => searchLocations(deferredPickupQuery),
    [deferredPickupQuery],
  );
  const dropoffMatches = useMemo(
    () => searchLocations(deferredDropoffQuery),
    [deferredDropoffQuery],
  );

  const currentOrderQuery = useQuery({
    queryKey: ["customer-order", sessionToken],
    enabled: Boolean(sessionToken) && session?.activeRole === "customer",
    queryFn: () => api.fetchCurrentCustomerOrder(sessionToken),
    refetchInterval: 7_000,
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.createCustomerOrder(
        buildComposerOrderInput({
          customerName,
          customerPhoneNumber,
          notes,
          priority,
          pickup: selectedPickup,
          dropoff: selectedDropoff,
        }),
        sessionToken,
      ),
    onSuccess: (value) => {
      queryClient.setQueryData(["customer-order", sessionToken], value);
    },
  });

  useEffect(() => {
    if (!session?.user.name) {
      return;
    }

    setCustomerName((current) => current || session.user.name);
  }, [session?.user.name]);

  useEffect(() => {
    const order = currentOrderQuery.data;
    const trackingToken = order?.order.trackingToken;

    if (!trackingToken) {
      return;
    }

    let dispose: () => void = () => undefined;
    let cancelled = false;

    void api
      .fetchTrackingRealtimeCredentials(trackingToken)
      .then((credentials) => {
        if (cancelled) {
          return;
        }

        dispose = bindWebEventSource(credentials.subscribeUrl, () => {
          void queryClient.invalidateQueries({ queryKey: ["customer-order", sessionToken] });
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      dispose();
    };
  }, [currentOrderQuery.data, queryClient, sessionToken]);

  if (!isLoading && !session) {
    return <Redirect href="/sign-in?next=/customer" />;
  }

  if (!isLoading && session?.activeRole === "driver") {
    return <Redirect href="/driver" />;
  }

  if (isLoading || !session) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color={palette.textMuted}>Loading customer session...</Text>
        </VStack>
      </DispatchScreen>
    );
  }

  const currentOrder = currentOrderQuery.data;
  const customerMap =
    selectedPickup && selectedDropoff
      ? buildPairMap(toAddressPoint(selectedPickup), toAddressPoint(selectedDropoff))
      : previewMap;
  const composerMarkers = [
    selectedPickup
      ? {
          stop: {
            kind: "pickup" as const,
            label: "Pickup",
            point: selectedPickup.point,
          },
          emphasized: true,
        }
      : null,
    selectedDropoff
      ? {
          stop: {
            kind: "dropoff" as const,
            label: "Dropoff",
            point: selectedDropoff.point,
          },
        }
      : null,
  ].filter(Boolean) as Array<{
    stop: {
      kind: "pickup" | "dropoff";
      label: string;
      point: { latitude: number; longitude: number };
    };
    emphasized?: boolean;
  }>;

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <Box style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {currentOrder ? (
            <VStack gap="$4" style={{ marginBottom: 20 }}>
              <VStack gap="$2">
                <Eyebrow>Customer operation</Eyebrow>
                <SectionHeader
                  title="Your live order"
                  detail="The same map persists from request creation through completion."
                  right={
                    <StatusPill
                      label={currentOrder.order.status.replaceAll("_", " ")}
                      tone="driver"
                    />
                  }
                />
              </VStack>

              <TrackingScene
                title="Live route"
                subtitle={orderStatusCopy[currentOrder.order.status].detail}
                tracking={currentOrder.tracking}
                shareUrl={currentOrder.shareUrl}
                actionLabel="Open public tracker"
              />

              {currentOrder.order.status === "pending_assignment" ||
              currentOrder.order.status === "offer_sent" ? (
                <GlowPanel tone="pickup">
                  <SectionHeader
                    title="Dispatch in progress"
                    detail="The backend is ranking nearby drivers, then sending concurrent offers."
                  />
                  <Text style={{ marginTop: 16, color: palette.textMuted, fontSize: 16 }}>
                    Current ETA target: {formatEta(currentOrder.tracking.map.etaMinutes)}
                  </Text>
                </GlowPanel>
              ) : null}
            </VStack>
          ) : (
            <VStack gap="$4" style={{ marginBottom: 20 }}>
              <NightCityMap
                map={customerMap}
                title="Create a new order"
                subtitle="Choose pickup and dropoff, then submit once. The map becomes the live tracker after dispatch."
                height={420}
                markers={composerMarkers}
              />

              <GlowPanel tone="pickup">
                <SectionHeader
                  title={`Welcome back, ${session.user.name}`}
                  detail="Customer mode is active. Your next request will stay pinned to the live map."
                  right={<StatusPill label="Customer" tone="pickup" />}
                />
                <VStack gap="$3" style={{ marginTop: 16 }}>
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
                      placeholder="Phone number"
                      keyboardType="phone-pad"
                      color={palette.text}
                      placeholderTextColor={palette.textMuted}
                    />
                  </Input>
                  <Textarea style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                    <TextareaInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Pickup notes, gate code, or landmark"
                      color={palette.text}
                      placeholderTextColor={palette.textMuted}
                    />
                  </Textarea>
                </VStack>

                <VStack gap="$3" style={{ marginTop: 20 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                    Priority mode
                  </Text>
                  {priorityModes.map((mode) => (
                    <TapCard key={mode.value} onPress={() => setPriority(mode.value)}>
                      <HStack justifyContent="space-between" alignItems="center" gap="$4">
                        <VStack flex={1} gap="$1">
                          <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                            {mode.label}
                          </Text>
                          <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                            {mode.detail}
                          </Text>
                        </VStack>
                        {priority === mode.value ? (
                          <StatusPill
                            label={mode.value === "priority" ? "Fastest" : "Balanced"}
                            tone={mode.value === "priority" ? "dropoff" : "pickup"}
                          />
                        ) : null}
                      </HStack>
                    </TapCard>
                  ))}
                </VStack>

                <Box style={{ marginTop: 20 }}>
                  <GlowButton
                    onPress={() => createOrderMutation.mutate()}
                    isLoading={createOrderMutation.isPending}
                  >
                    Send order to dispatch
                  </GlowButton>
                </Box>
              </GlowPanel>

              <LocationPicker
                title="Pickup search"
                value={pickupQuery}
                onChangeText={setPickupQuery}
                matches={pickupMatches}
                selectedId={selectedPickup.id}
                onSelect={(location) => {
                  setSelectedPickup(location);
                  setPickupQuery(location.label);
                }}
              />

              <LocationPicker
                title="Dropoff search"
                value={dropoffQuery}
                onChangeText={setDropoffQuery}
                matches={dropoffMatches}
                selectedId={selectedDropoff.id}
                onSelect={(location) => {
                  setSelectedDropoff(location);
                  setDropoffQuery(location.label);
                }}
              />
            </VStack>
          )}

          <GlowButton tone="ghost" variant="outline" onPress={() => router.push("/settings")}>
            Open account and role settings
          </GlowButton>
        </Box>
      </ScrollView>
    </DispatchScreen>
  );
}
