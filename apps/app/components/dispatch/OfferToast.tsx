import type { Offer } from "@drops/contracts";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { palette } from "@drops/ui";
import { formatCountdown } from "@/lib/dispatch-data";

export const OfferToast = ({
  offer,
  visible,
}: {
  offer: Offer | null;
  visible: boolean;
}) => {
  const translateY = useRef(new Animated.Value(-90)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -90,
      useNativeDriver: true,
      friction: 7,
      tension: 65,
    }).start();
  }, [translateY, visible]);

  if (!offer) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.shell,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Incoming order</Text>
        <Text style={styles.timer}>{formatCountdown(offer.expiresAt)}</Text>
      </View>
      <Text style={styles.title}>{offer.pickup.addressLine}</Text>
      <Text style={styles.meta}>
        Drop at {offer.dropoff.addressLine}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  kicker: {
    color: palette.pickup,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  meta: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  shell: {
    backgroundColor: "rgba(5,8,22,0.96)",
    borderColor: palette.pickup,
    borderRadius: 22,
    borderWidth: 1,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: "absolute",
    right: 20,
    top: 18,
    zIndex: 30,
  },
  timer: {
    color: palette.warning,
    fontFamily: "Courier New",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: palette.text,
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 8,
  },
});
