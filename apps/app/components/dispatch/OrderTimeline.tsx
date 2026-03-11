import type { OrderEvent } from "@drops/contracts";
import { Box, HStack, Text, VStack } from "@gluestack-ui/themed";
import { palette } from "@drops/ui";

export const OrderTimeline = ({ events }: { events: OrderEvent[] }) => (
  <VStack gap="$4">
    {events.map((event) => (
      <HStack
        key={`${event.orderId}:${event.happenedAt}:${event.status}`}
        alignItems="flex-start"
        gap="$3"
      >
        <Box
          width={10}
          height={10}
          style={{ marginTop: 4, borderRadius: 999, backgroundColor: palette.pickup }}
        />
        <VStack gap="$1" flex={1}>
          <Text
            style={{
              color: palette.text,
              fontSize: 14,
              fontWeight: "700",
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            {event.status.replaceAll("_", " ")}
          </Text>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>
            {new Date(event.happenedAt).toLocaleTimeString()}
          </Text>
          {event.note ? (
            <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 20 }}>
              {event.note}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    ))}
  </VStack>
);
