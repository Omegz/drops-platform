import { StyleSheet, Text, View } from "react-native";

const palette = {
  accepted: { backgroundColor: "#203A24", color: "#B8FF65" },
  online: { backgroundColor: "#203A24", color: "#B8FF65" },
  offer_sent: { backgroundColor: "#382A15", color: "#FFBF71" },
  on_the_way: { backgroundColor: "#1E2E36", color: "#75D6FF" },
  picked_up: { backgroundColor: "#2A2041", color: "#D4B8FF" },
  dropped_off: { backgroundColor: "#2A3A1F", color: "#DAFFB7" },
  pending_assignment: { backgroundColor: "#382A15", color: "#FFBF71" },
  no_driver_found: { backgroundColor: "#332424", color: "#FF8C7A" },
  offline: { backgroundColor: "#332424", color: "#FF8C7A" },
  cancelled: { backgroundColor: "#332424", color: "#FF8C7A" },
};

type StatusBadgeProps = {
  label: string;
};

export const StatusBadge = ({ label }: StatusBadgeProps) => {
  const style = palette[label as keyof typeof palette] ?? {
    backgroundColor: "#25302B",
    color: "#F1F4F1",
  };

  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.text, { color: style.color }]}>
        {label.replaceAll("_", " ").toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
});
