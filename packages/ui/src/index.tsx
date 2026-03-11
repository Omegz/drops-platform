import type { PropsWithChildren, ReactNode } from "react";
import {
  Badge,
  BadgeText,
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  GluestackUIProvider,
  Heading,
  HStack,
  Pressable,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { config } from "@gluestack-ui/config";

export const palette = {
  background: "#050816",
  backgroundMuted: "#0B1021",
  surface: "#0E152C",
  surfaceAlt: "#16203B",
  border: "#24335F",
  text: "#E9F2FF",
  textMuted: "#8B9BC7",
  pickup: "#98FF7A",
  dropoff: "#FF7A45",
  driver: "#61D8FF",
  warning: "#FFC857",
};

export const DispatchUIProvider = ({ children }: PropsWithChildren) => (
  <GluestackUIProvider config={config}>{children}</GluestackUIProvider>
);

export const DispatchScreen = ({
  children,
  padded = true,
}: PropsWithChildren<{ padded?: boolean }>) => (
  <Box
    flex={1}
    style={{
      backgroundColor: palette.background,
      paddingHorizontal: padded ? 20 : 0,
      paddingVertical: padded ? 20 : 0,
    }}
  >
    {children}
  </Box>
);

export const GlowPanel = ({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "pickup" | "dropoff" | "driver" }>) => {
  const toneBorder =
    tone === "pickup"
      ? palette.pickup
      : tone === "dropoff"
        ? palette.dropoff
        : tone === "driver"
          ? palette.driver
          : palette.border;

  return (
    <Box
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: toneBorder,
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingVertical: 20,
        shadowColor: toneBorder,
        shadowOpacity: 0.18,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
      }}
    >
      {children}
    </Box>
  );
};

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <Text
    style={{
      color: palette.pickup,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 4,
      textTransform: "uppercase",
    }}
  >
    {children}
  </Text>
);

export const HeroTitle = ({ children }: { children: ReactNode }) => (
  <Heading style={{ color: palette.text, fontSize: 42, lineHeight: 46 }}>
    {children}
  </Heading>
);

export const SupportingText = ({ children }: { children: ReactNode }) => (
  <Text style={{ color: palette.textMuted, fontSize: 16, lineHeight: 24 }}>
    {children}
  </Text>
);

export const StatusPill = ({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "pickup" | "dropoff" | "driver" | "warning";
}) => {
  const background =
    tone === "pickup"
      ? "#132C17"
      : tone === "dropoff"
        ? "#351B15"
        : tone === "driver"
          ? "#14253A"
          : tone === "warning"
            ? "#372D14"
            : "#16203B";
  const color =
    tone === "pickup"
      ? palette.pickup
      : tone === "dropoff"
        ? palette.dropoff
        : tone === "driver"
          ? palette.driver
          : tone === "warning"
            ? palette.warning
            : palette.text;

  return (
    <Badge style={{ backgroundColor: background, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
      <BadgeText style={{ color, fontSize: 11, letterSpacing: 1.5 }}>
        {label.toUpperCase()}
      </BadgeText>
    </Badge>
  );
};

export const GlowButton = ({
  children,
  tone = "primary",
  isLoading,
  onPress,
  variant = "solid",
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "ghost";
  isLoading?: boolean;
  onPress?: () => void;
  variant?: "solid" | "outline";
}) => {
  const actionColor =
    tone === "primary"
      ? palette.pickup
      : tone === "secondary"
        ? palette.dropoff
        : palette.driver;

  return (
    <Button
      onPress={onPress}
      variant={variant}
      style={{
        backgroundColor: variant === "solid" ? actionColor : palette.surfaceAlt,
        borderColor: actionColor,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 56,
      }}
    >
      {isLoading ? <ButtonSpinner style={{ marginRight: 8 }} color={palette.background} /> : null}
      <ButtonText
        style={{
          color: variant === "solid" ? palette.background : actionColor,
          fontWeight: "700",
        }}
      >
        {children}
      </ButtonText>
    </Button>
  );
};

export const TapCard = ({
  children,
  onPress,
}: PropsWithChildren<{ onPress?: () => void }>) => (
  <Pressable onPress={onPress}>
    <GlowPanel>{children}</GlowPanel>
  </Pressable>
);

export const MetricRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <VStack gap="$1">
    <Text style={{ color: palette.textMuted, fontSize: 11, letterSpacing: 2 }}>
      {label.toUpperCase()}
    </Text>
    <Text style={{ color: palette.text, fontWeight: "700", fontSize: 18 }}>
      {value}
    </Text>
  </VStack>
);

export const SectionHeader = ({
  title,
  detail,
  right,
}: {
  title: string;
  detail?: string;
  right?: ReactNode;
}) => (
  <HStack justifyContent="space-between" alignItems="center">
    <VStack gap="$1" flex={1}>
      <Heading style={{ color: palette.text, fontSize: 22 }}>
        {title}
      </Heading>
      {detail ? (
        <Text style={{ color: palette.textMuted, fontSize: 14 }}>
          {detail}
        </Text>
      ) : null}
    </VStack>
    {right}
  </HStack>
);
