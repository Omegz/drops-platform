import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Box, ScrollView, Text, VStack } from "@gluestack-ui/themed";
import { DispatchScreen, Eyebrow, SupportingText, palette } from "@drops/ui";
import { TrackingScene } from "@/components/dispatch/TrackingScene";
import { api } from "@/lib/api";
import { bindWebEventSource } from "@/lib/realtime";

export default function PublicTrackingScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const trackingQuery = useQuery({
    queryKey: ["public-tracking", token],
    enabled: Boolean(token),
    queryFn: () => api.fetchTracking(token),
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    let dispose: () => void = () => undefined;
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

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 42 }}>
        <Box style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <VStack gap="$2">
            <Eyebrow>Public tracking</Eyebrow>
            <SupportingText>
              This view stays open for the customer side or any shared tracking recipient. It refreshes automatically as the driver advances through the route.
            </SupportingText>
          </VStack>

          {trackingQuery.data ? (
            <TrackingScene
              title="Live tracker"
              subtitle="Public, read-only visibility into the driver and current trip leg."
              tracking={trackingQuery.data}
              shareUrl={trackingQuery.data.trackingUrl}
              actionLabel="Open canonical tracking URL"
            />
          ) : (
            <VStack alignItems="center" gap="$3" style={{ paddingVertical: 64 }}>
              <Text style={{ color: palette.textMuted }}>
                {trackingQuery.isLoading
                  ? "Loading tracking token..."
                  : "Tracking token not found or no longer active."}
              </Text>
            </VStack>
          )}
        </Box>
      </ScrollView>
    </DispatchScreen>
  );
}
