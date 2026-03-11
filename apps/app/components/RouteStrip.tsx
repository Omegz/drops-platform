import type { AddressPoint, Coordinate } from "@drops/contracts";
import { StyleSheet, Text, View } from "react-native";

type RouteStripProps = {
  pickup: AddressPoint;
  dropoff: AddressPoint;
  driverPoint?: Coordinate | null;
};

const CoordinateText = ({ point }: { point: Coordinate }) => (
  <Text style={styles.point}>
    {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
  </Text>
);

export const RouteStrip = ({ pickup, dropoff, driverPoint }: RouteStripProps) => (
  <View style={styles.container}>
    <View style={styles.column}>
      <View style={[styles.dot, styles.pickupDot]} />
      <View style={styles.line} />
      <View style={[styles.dot, styles.dropoffDot]} />
    </View>
    <View style={styles.content}>
      <View style={styles.stop}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.address}>{pickup.addressLine}</Text>
        <CoordinateText point={pickup.point} />
      </View>
      <View style={styles.stop}>
        <Text style={styles.label}>Driver</Text>
        <Text style={styles.address}>
          {driverPoint ? "Live location connected" : "Waiting for driver GPS"}
        </Text>
        {driverPoint ? <CoordinateText point={driverPoint} /> : null}
      </View>
      <View style={styles.stop}>
        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.address}>{dropoff.addressLine}</Text>
        <CoordinateText point={dropoff.point} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  address: {
    color: "#F5F6F1",
    fontSize: 16,
    fontWeight: "700",
  },
  column: {
    alignItems: "center",
    paddingTop: 4,
    width: 22,
  },
  container: {
    flexDirection: "row",
    gap: 14,
  },
  content: {
    flex: 1,
    gap: 18,
  },
  dot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  dropoffDot: {
    backgroundColor: "#FF8C42",
  },
  label: {
    color: "#8F9A91",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  line: {
    backgroundColor: "#2B332F",
    flex: 1,
    marginVertical: 6,
    width: 2,
  },
  pickupDot: {
    backgroundColor: "#B8FF65",
  },
  point: {
    color: "#9EABA2",
    fontSize: 12,
    marginTop: 4,
  },
  stop: {
    gap: 1,
  },
});
