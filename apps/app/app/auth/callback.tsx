import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Box, Spinner, Text, VStack } from "@gluestack-ui/themed";
import { DispatchScreen, Eyebrow, HeroTitle, SupportingText, palette } from "@drops/ui";
import { useSession } from "@/lib/session";

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ sessionToken?: string; next?: string }>();
  const router = useRouter();
  const { setSessionToken } = useSession();

  useEffect(() => {
    if (typeof params.sessionToken !== "string" || !params.sessionToken) {
      router.replace("/sign-in");
      return;
    }

    setSessionToken(params.sessionToken);
    router.replace(typeof params.next === "string" && params.next ? params.next : "/customer");
  }, [params.next, params.sessionToken, router, setSessionToken]);

  return (
    <DispatchScreen>
      <VStack flex={1} justifyContent="center" alignItems="center" gap="$4">
        <Eyebrow>Authorizing</Eyebrow>
        <HeroTitle>Opening your dispatch session.</HeroTitle>
        <SupportingText>
          The secure session token is being stored locally before you re-enter the app.
        </SupportingText>
        <Box style={{ marginTop: 8 }}>
          <Spinner color={palette.pickup} size="large" />
        </Box>
        <Text style={{ color: palette.textMuted, fontSize: 14 }}>
          If this stalls, return to sign-in and request a fresh link.
        </Text>
      </VStack>
    </DispatchScreen>
  );
}
