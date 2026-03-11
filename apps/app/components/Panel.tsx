import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type PanelProps = {
  children: ReactNode;
};

export const Panel = ({ children }: PanelProps) => (
  <View style={styles.panel}>{children}</View>
);

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#141918",
    borderColor: "#29322D",
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#040605",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
  },
});
