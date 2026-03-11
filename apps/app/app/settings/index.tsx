import { Redirect, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Box, HStack, ScrollView, Text, VStack } from "@gluestack-ui/themed";
import {
  DispatchScreen,
  Eyebrow,
  GlowButton,
  GlowPanel,
  SectionHeader,
  StatusPill,
  SupportingText,
  palette,
} from "@drops/ui";
import { useSession } from "@/lib/session";

export default function SettingsScreen() {
  const { isLoading, session, switchRole, signOut } = useSession();

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      router.replace("/");
    },
  });

  if (!isLoading && !session) {
    return <Redirect href="/sign-in" />;
  }

  if (isLoading || !session) {
    return (
      <DispatchScreen>
        <VStack flex={1} justifyContent="center" alignItems="center">
          <Text color={palette.textMuted}>Loading account settings...</Text>
        </VStack>
      </DispatchScreen>
    );
  }

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 42 }}>
        <Box style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <VStack gap="$2">
            <Eyebrow>Account control</Eyebrow>
            <SectionHeader
              title={session.user.name}
              detail={session.user.email}
              right={<StatusPill label={session.activeRole} tone="driver" />}
            />
            <SupportingText>
              Role switching stays in one place so the same account can move between customer and driver surfaces without a second app today.
            </SupportingText>
          </VStack>

          <GlowPanel tone="driver">
            <SectionHeader
              title="Available roles"
              detail="Driver mode appears only when the account is linked to an approved driver record."
            />
            <VStack gap="$3" style={{ marginTop: 16 }}>
              {session.availableRoles.map((role) => (
                <GlowPanel key={role} tone={role === "driver" ? "driver" : role === "customer" ? "pickup" : "dropoff"}>
                  <HStack justifyContent="space-between" alignItems="center" gap="$4">
                    <VStack flex={1} gap="$1">
                      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "700" }}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                      <Text style={{ color: palette.textMuted, fontSize: 14 }}>
                        {role === "driver"
                          ? "Idle city map, live offers, and swipe task progression."
                          : role === "customer"
                            ? "Order creation, waiting state, and public tracking."
                            : "Administrative role reserved for invitation and oversight work."}
                      </Text>
                    </VStack>
                    {session.activeRole === role ? (
                      <StatusPill label="Active" tone="pickup" />
                    ) : (
                      <GlowButton onPress={() => void switchRole(role)}>
                        Switch
                      </GlowButton>
                    )}
                  </HStack>
                </GlowPanel>
              ))}
            </VStack>
          </GlowPanel>

          {!session.availableRoles.includes("driver") ? (
            <GlowPanel>
              <SectionHeader
                title="Driver mode is invite-only"
                detail="A linked driver account is required before the driver console is exposed."
              />
            </GlowPanel>
          ) : null}

          <GlowPanel tone="dropoff">
            <SectionHeader
              title="Session"
              detail="Signing out clears the local bearer token and returns you to the public landing page."
            />
            <Box style={{ marginTop: 16 }}>
              <GlowButton
                tone="secondary"
                onPress={() => signOutMutation.mutate()}
                isLoading={signOutMutation.isPending}
              >
                Sign out
              </GlowButton>
            </Box>
          </GlowPanel>
        </Box>
      </ScrollView>
    </DispatchScreen>
  );
}
