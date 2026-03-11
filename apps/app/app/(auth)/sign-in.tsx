import { useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useMutation } from "@tanstack/react-query";
import { Box, HStack, Input, InputField, ScrollView, Text, VStack } from "@gluestack-ui/themed";
import { NightCityMap } from "@drops/maps";
import {
  DispatchScreen,
  Eyebrow,
  GlowButton,
  GlowPanel,
  HeroTitle,
  SectionHeader,
  StatusPill,
  SupportingText,
  TapCard,
  palette,
} from "@drops/ui";
import { api } from "@/lib/api";
import { previewMap } from "@/lib/dispatch-data";
import { useSession } from "@/lib/session";

const driverDemoEmails = [
  "driver_demo_01@drops.app",
  "driver_demo_02@drops.app",
  "driver_demo_03@drops.app",
];

export default function SignInScreen() {
  const params = useLocalSearchParams<{ next?: string }>();
  const initialNext = typeof params.next === "string" ? params.next : "/customer";
  const { isLoading, session, providers } = useSession();
  const [email, setEmail] = useState("dispatch@client.demo");
  const [name, setName] = useState("Ari North");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState(initialNext);

  const requestMutation = useMutation({
    mutationFn: () =>
      api.requestMagicLink({
        email,
        name,
        redirectPath: targetPath,
      }),
    onSuccess: (value) => {
      setPreviewUrl(value.previewUrl ?? null);
    },
  });

  if (!isLoading && session) {
    return <Redirect href={session.activeRole === "driver" ? "/driver" : "/customer"} />;
  }

  return (
    <DispatchScreen padded={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 42 }}>
        <Box style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <NightCityMap
            map={previewMap}
            title="Secure sign-in"
            subtitle="Magic links return you to the correct customer or driver route after verification."
            height={340}
          />

          <VStack gap="$4" style={{ marginTop: 20 }}>
            <VStack gap="$2">
              <Eyebrow>Magic link access</Eyebrow>
              <HeroTitle>Enter one identity, then switch roles when your account allows it.</HeroTitle>
              <SupportingText>
                Customer access is default. Driver access unlocks once the account is linked to an approved driver profile.
              </SupportingText>
            </VStack>

            <GlowPanel tone="driver">
              <SectionHeader
                title="Account details"
                detail="Use any email for customer mode. Use a seeded driver email to demo driver mode."
                right={<StatusPill label={targetPath === "/driver" ? "Driver return" : "Customer return"} tone="driver" />}
              />

              <VStack gap="$3" style={{ marginTop: 20 }}>
                <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                  <InputField
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    color={palette.text}
                    placeholderTextColor={palette.textMuted}
                  />
                </Input>
                <Input style={{ backgroundColor: "transparent", borderColor: palette.border }}>
                  <InputField
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="Email address"
                    color={palette.text}
                    placeholderTextColor={palette.textMuted}
                  />
                </Input>
              </VStack>

              <Box style={{ marginTop: 20 }}>
                <GlowButton onPress={() => requestMutation.mutate()} isLoading={requestMutation.isPending}>
                  Send secure link
                </GlowButton>
              </Box>

              {previewUrl ? (
                <VStack gap="$3" style={{ marginTop: 16 }}>
                  <Text style={{ color: palette.warning, fontSize: 14, fontWeight: "700" }}>
                    Email delivery is not configured here, so the API exposed a preview link.
                  </Text>
                  <GlowButton
                    tone="secondary"
                    variant="outline"
                    onPress={() => void Linking.openURL(previewUrl)}
                  >
                    Open preview sign-in
                  </GlowButton>
                </VStack>
              ) : null}

              <Text style={{ marginTop: 16, color: palette.textMuted, fontSize: 14 }}>
                Magic links: {providers.magicLinkEnabled ? "enabled" : "disabled"}.
                {" "}Google provider wiring is environment-dependent.
              </Text>
            </GlowPanel>

            <GlowPanel>
              <SectionHeader
                title="Driver demo identities"
                detail="These accounts are pre-linked to seeded driver records."
              />
              <VStack gap="$3" style={{ marginTop: 16 }}>
                {driverDemoEmails.map((driverEmail) => (
                  <TapCard key={driverEmail} onPress={() => {
                    setEmail(driverEmail);
                    setName(driverEmail.split("@")[0] ?? "Driver");
                    setTargetPath("/driver");
                  }}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700" }}>
                        {driverEmail}
                      </Text>
                      <StatusPill label="Driver" tone="pickup" />
                    </HStack>
                  </TapCard>
                ))}
              </VStack>
            </GlowPanel>
          </VStack>
        </Box>
      </ScrollView>
    </DispatchScreen>
  );
}
