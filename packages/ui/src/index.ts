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
    bg={palette.background}
    px={padded ? "$5" : "$0"}
    py={padded ? "$5" : "$0"}
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
      bg={palette.surface}
      borderWidth={1}
      borderColor={toneBorder}
      borderRadius="$3xl"
      px="$5"
      py="$5"
      shadowColor={toneBorder}
      shadowOpacity={0.18}
      shadowRadius={22}
      shadowOffset={{ width: 0, height: 12 }}
    >
      {children}
    </Box>
  );
};

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <Text
    color={palette.pickup}
    fontSize="$xs"
    fontWeight="$bold"
    letterSpacing={4}
    textTransform="uppercase"
  >
    {children}
  </Text>
);

export const HeroTitle = ({ children }: { children: ReactNode }) => (
  <Heading color={palette.text} fontSize="$5xl" lineHeight="$5xl">
    {children}
  </Heading>
);

export const SupportingText = ({ children }: { children: ReactNode }) => (
  <Text color={palette.textMuted} fontSize="$md" lineHeight="$xl">
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
    <Badge bg={background} borderRadius="$full" px="$3" py="$1.5">
      <BadgeText color={color} fontSize="$2xs" letterSpacing={1.5}>
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
      bg={variant === "solid" ? actionColor : palette.surfaceAlt}
      borderColor={actionColor}
      borderWidth={1}
      borderRadius="$full"
      px="$5"
      py="$3"
      minHeight={56}
    >
      {isLoading ? <ButtonSpinner mr="$2" color={palette.background} /> : null}
      <ButtonText
        color={variant === "solid" ? palette.background : actionColor}
        fontWeight="$bold"
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
    <Text color={palette.textMuted} fontSize="$2xs" letterSpacing={2}>
      {label.toUpperCase()}
    </Text>
    <Text color={palette.text} fontWeight="$bold" fontSize="$lg">
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
      <Heading color={palette.text} fontSize="$xl">
        {title}
      </Heading>
      {detail ? (
        <Text color={palette.textMuted} fontSize="$sm">
          {detail}
        </Text>
      ) : null}
    </VStack>
    {right}
  </HStack>
);
