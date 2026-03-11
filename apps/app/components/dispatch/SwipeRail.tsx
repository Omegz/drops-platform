import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { palette } from "@drops/ui";

const KNOB_SIZE = 54;
const TRACK_PADDING = 4;
const TRACK_WIDTH = 292;
const MAX_TRANSLATE = TRACK_WIDTH - KNOB_SIZE - TRACK_PADDING * 2;

export const SwipeRail = ({
  label,
  accent = palette.pickup,
  disabled,
  isLoading,
  onComplete,
}: {
  label: string;
  accent?: string;
  disabled?: boolean;
  isLoading?: boolean;
  onComplete: () => void;
}) => {
  const translate = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);

  const reset = () => {
    Animated.spring(translate, {
      toValue: 0,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
    setCompleted(false);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => !disabled && !isLoading,
        onPanResponderMove: (_event, gestureState) => {
          translate.setValue(Math.max(0, Math.min(MAX_TRANSLATE, gestureState.dx)));
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx >= MAX_TRANSLATE * 0.74) {
            setCompleted(true);
            Animated.timing(translate, {
              toValue: MAX_TRANSLATE,
              duration: 140,
              useNativeDriver: true,
            }).start(() => {
              onComplete();
              setTimeout(reset, 320);
            });
            return;
          }

          reset();
        },
        onPanResponderTerminate: reset,
      }),
    [disabled, isLoading, onComplete, translate],
  );

  return (
    <View style={[styles.track, disabled ? styles.trackDisabled : null]}>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: accent }]}>
          {completed ? "Confirmed" : label}
        </Text>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            backgroundColor: accent,
            transform: [{ translateX: translate }],
          },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator color={palette.background} />
        ) : (
          <Text style={styles.arrow}>»</Text>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  arrow: {
    color: palette.background,
    fontSize: 22,
    fontWeight: "900",
  },
  knob: {
    alignItems: "center",
    borderRadius: 999,
    height: KNOB_SIZE,
    justifyContent: "center",
    left: TRACK_PADDING,
    position: "absolute",
    top: TRACK_PADDING,
    width: KNOB_SIZE,
  },
  label: {
    fontFamily: "Courier New",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  labelWrap: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  track: {
    backgroundColor: "rgba(11,16,33,0.96)",
    borderColor: palette.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 62,
    overflow: "hidden",
    position: "relative",
    width: TRACK_WIDTH,
  },
  trackDisabled: {
    opacity: 0.58,
  },
});
