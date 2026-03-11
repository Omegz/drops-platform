import { Redirect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Box, HStack, ScrollView, Text, VStack } from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
import {
  DispatchScreen,
  Eyebrow,
  GlowButton,
  GlowPanel,
  HeroTitle,
  MetricRow,
  SectionHeader,
  SupportingText,
  palette,
} from "@drops/ui";
import { buildTrackingMarkers, previewMap } from "@/lib/dispatch-data";
import { useSession } from "@/lib/session";

const previewTrackingMarkers = buildTrackingMarkers({
  orderId: "preview",
  status: "offer_sent",
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
    name: "Sara Nielsen",
    vehicleLabel: "Bike 4",
    point: { latitude: 55.6841, longitude: 12.5814 },
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
          colors={["#06101B", "#040711", "#130C1C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 26 }}
        >
          <VStack gap="$5">
            <VStack gap="$3">
              <Eyebrow>Unified Dispatch</Eyebrow>
              <HeroTitle>Night-shift dispatch for customers, drivers, and public tracking in one shared Expo app.</HeroTitle>
              <SupportingText>
                Customers create and watch a live run on the same map. Drivers stay on a city watch surface with offers, task progression, and external navigation handoff.
              </SupportingText>
            </VStack>

            <NightCityMap
              map={previewMap}
              title="Control room preview"
              subtitle="Pickup, dropoff, and driver movement stay bright on one shared dispatch canvas."
              markers={previewTrackingMarkers}
              height={430}
            />

            <HStack gap="$3" flexWrap="wrap">
              <GlowButton
                onPress={() =>
                  router.push({
                    pathname: "/sign-in",
                    params: { next: "/customer" },
                  })
                }
              >
                Sign in to order
              </GlowButton>
              <GlowButton
                tone="secondary"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: "/sign-in",
                    params: { next: "/driver" },
                  })
                }
              >
                Driver sign-in
              </GlowButton>
            </HStack>

            <HStack gap="$5" flexWrap="wrap">
              <MetricRow label="Surface" value="One Expo app" />
              <MetricRow label="Realtime" value="SaaSignal channels" />
              <MetricRow label="Routing" value="SaaSignal logistics" />
            </HStack>
          </VStack>
        </LinearGradient>

        <VStack gap="$4" style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <GlowPanel tone="pickup">
            <SectionHeader
              title="Customer-first entry"
              detail="Signed-out users start here. Once signed in, customer mode stays focused on request creation and live order state."
            />
            <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 24, marginTop: 16 }}>
              The customer path does not split into a second frontend anymore. Order creation, waiting state, and shared tracking all live behind the same shell.
            </Text>
          </GlowPanel>

          <GlowPanel tone="driver">
            <SectionHeader
              title="Driver operations"
              detail="Approved driver accounts switch roles inside the app and land on a map-first operational surface."
            />
            <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 24, marginTop: 16 }}>
              Incoming offers surface on the live city map, task state moves with swipe controls, and Google Maps is only the external navigation launcher.
            </Text>
          </GlowPanel>

          <Box style={{ paddingBottom: 24 }}>
            <Text style={{ color: palette.textMuted, fontSize: 14 }}>
              Public tracking stays directly visitable at `/track/[token]`, without requiring login.
            </Text>
          </Box>
        </VStack>
      </ScrollView>
    </DispatchScreen>
  );
}
