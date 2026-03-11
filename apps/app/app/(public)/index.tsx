import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Box, Divider, HStack, ScrollView, Text, VStack } from "@gluestack-ui/themed";
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
  palette,
} from "@drops/ui";
import { useSession } from "@/lib/session";
import { previewMap } from "@/lib/dispatch-data";
import { buildTrackingMarkers } from "@/lib/dispatch-data";

const previewTrackingMarkers = buildTrackingMarkers({
  orderId: "preview",
  status: "on_the_way",
  trackingUrl: "https://drops.example/track/demo",
  pickup: {
    addressLine: "Nyhavn 1, Copenhagen",
    point: { latitude: 55.6799, longitude: 12.5911 },
  },
  dropoff: {
    addressLine: "Opera House, Copenhagen",
    point: { latitude: 55.6826, longitude: 12.6006 },
  },
  driver: {
    id: "drv_preview",
    name: "Mikael",
    vehicleLabel: "City EV",
    point: { latitude: 55.6814, longitude: 12.5951 },
    updatedAt: new Date().toISOString(),
  },
  timeline: [],
  map: previewMap,
});

export default function LandingScreen() {
  const { isLoading, session } = useSession();

  if (!isLoading && session) {
    return <Redirect href={session.activeRole === "driver" ? "/driver" : "/customer"} />;
  }

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <LinearGradient
          colors={["#0A0F20", "#07111A", "#040711"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22 }}
        >
          <VStack gap="$5">
            <VStack gap="$3">
              <Eyebrow>Unified Dispatch App</Eyebrow>
              <HeroTitle>One map-led product for customers now, split-ready for drivers later.</HeroTitle>
              <SupportingText>
                The customer creates a pickup and dropoff request. The closest viable driver gets an offer, accepts or rejects it, then moves through pickup and delivery with live tracking.
              </SupportingText>
            </VStack>

            <NightCityMap
              map={previewMap}
              title="Night dispatch board"
              subtitle="Pickup and dropoff stay bright while the live driver position feeds the customer tracker."
              markers={previewTrackingMarkers}
              height={430}
            />

            <HStack gap="$3" flexWrap="wrap">
              <GlowButton onPress={() => router.push("/sign-in?next=/customer")}>
                Enter customer flow
              </GlowButton>
              <GlowButton
                tone="secondary"
                variant="outline"
                onPress={() => router.push("/sign-in?next=/driver")}
              >
                Enter driver console
              </GlowButton>
            </HStack>
          </VStack>
        </LinearGradient>

        <VStack gap="$4" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <GlowPanel tone="driver">
            <SectionHeader
              title="What feels different"
              detail="This is a control-room product, not a dashboard stack."
              right={<StatusPill label="PWA live" tone="pickup" />}
            />
            <HStack gap="$5" flexWrap="wrap" style={{ marginTop: 20 }}>
              <MetricRow label="Realtime" value="Driver + tracker streams" />
              <MetricRow label="Allocation" value="Distance + load aware" />
              <MetricRow label="Flow" value="Request -> offer -> ride" />
            </HStack>
          </GlowPanel>

          <GlowPanel>
            <VStack gap="$4">
              <SectionHeader
                title="Customer side"
                detail="Map-first order creation, waiting state, and public live tracking."
              />
              <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 24 }}>
                Customers choose pickup and dropoff on the city map, submit once, and stay on the same surface until the driver completes the run.
              </Text>
            </VStack>
          </GlowPanel>

          <GlowPanel tone="dropoff">
            <VStack gap="$4">
              <SectionHeader
                title="Driver side"
                detail="Idle city map, incoming offer toast, and swipe-based progression."
              />
              <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 24 }}>
                Drivers can go online, inspect the order context directly on the map, launch navigation to the active stop, and close the run with a deliberate swipe.
              </Text>
            </VStack>
          </GlowPanel>

          <Divider style={{ backgroundColor: palette.border }} />

          <Box style={{ paddingBottom: 24 }}>
            <Text style={{ color: palette.textMuted, fontSize: 14 }}>
              Invite-only driver mode can be attached to the same account later from settings.
            </Text>
          </Box>
        </VStack>
      </ScrollView>
    </DispatchScreen>
  );
}
