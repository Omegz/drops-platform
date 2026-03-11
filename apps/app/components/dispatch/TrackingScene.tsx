import type { TrackingSnapshot } from "@drops/contracts";
import { Avatar, AvatarFallbackText, Box, HStack, Heading, Text, VStack } from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
import {
  GlowButton,
  GlowPanel,
  SectionHeader,
  StatusPill,
  SupportingText,
  palette,
} from "@drops/ui";
import * as Linking from "expo-linking";
import { OrderTimeline } from "./OrderTimeline";
import { buildTrackingMarkers, formatEta, orderStatusCopy } from "@/lib/dispatch-data";

export const TrackingScene = ({
  title,
  subtitle,
  tracking,
  shareUrl,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  tracking: TrackingSnapshot;
  shareUrl?: string;
  actionLabel?: string;
}) => {
  const statusCopy = orderStatusCopy[tracking.status];

  return (
    <VStack gap="$4">
      <NightCityMap
        map={tracking.map}
        title={title}
        subtitle={subtitle}
        height={470}
        markers={buildTrackingMarkers(tracking)}
      />

      <GlowPanel tone="driver">
        <SectionHeader
          title={statusCopy.label}
          detail={statusCopy.detail}
          right={
            <StatusPill
              label={tracking.status.replaceAll("_", " ")}
              tone={tracking.status === "picked_up" ? "dropoff" : "driver"}
            />
          }
        />

        <HStack gap="$4" alignItems="center" style={{ marginTop: 16 }}>
          <Avatar size="md" style={{ backgroundColor: "#1B2239" }}>
            <AvatarFallbackText>
              {tracking.driver?.name ?? "Queue"}
            </AvatarFallbackText>
          </Avatar>
          <VStack flex={1} gap="$1">
            <Heading style={{ color: palette.text, fontSize: 18 }}>
              {tracking.driver?.name ?? "Awaiting assignment"}
            </Heading>
            <Text style={{ color: palette.textMuted, fontSize: 14 }}>
              {tracking.driver?.vehicleLabel ?? "The dispatch board is still matching the best driver."}
            </Text>
            <Text style={{ color: palette.driver, fontSize: 14, fontWeight: "700" }}>
              ETA {formatEta(tracking.map.etaMinutes)}
            </Text>
          </VStack>
        </HStack>

        {shareUrl ? (
          <Box style={{ marginTop: 16 }}>
            <GlowButton onPress={() => void Linking.openURL(shareUrl)}>
              {actionLabel ?? "Open live tracker"}
            </GlowButton>
          </Box>
        ) : null}
      </GlowPanel>

      <GlowPanel>
        <SectionHeader
          title="Trip stream"
          detail="State changes land here in timestamp order."
        />
        <Box style={{ marginTop: 16 }}>
          <OrderTimeline events={tracking.timeline} />
        </Box>
      </GlowPanel>

      <GlowPanel>
        <VStack gap="$2">
          <Text
            style={{
              color: palette.pickup,
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Route
          </Text>
          <Heading style={{ color: palette.text, fontSize: 16 }}>
            {tracking.pickup.addressLine}
          </Heading>
          <SupportingText>
            Pickup point
          </SupportingText>
          <Box
            borderLeftWidth={1}
            borderLeftColor={palette.border}
            minHeight={26}
            style={{ marginLeft: 4 }}
          />
          <Heading style={{ color: palette.text, fontSize: 16 }}>
            {tracking.dropoff.addressLine}
          </Heading>
          <SupportingText>
            Dropoff point
          </SupportingText>
        </VStack>
      </GlowPanel>
    </VStack>
  );
};
