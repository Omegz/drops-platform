import type { PropsWithChildren } from "react";
import type { AppRole, AppSession, SessionState } from "@drops/contracts";
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  setStoredSessionToken,
} from "@drops/auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "./api";

type SessionContextValue = {
  isLoading: boolean;
  session: AppSession | null;
  providers: SessionState["providers"];
  sessionToken: string | null;
  setSessionToken: (token: string | null) => void;
  refreshSession: () => Promise<void>;
  switchRole: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionTokenState] = useState<string | null>(
    getStoredSessionToken(),
  );

  const sessionQuery = useQuery({
    queryKey: ["session-state", sessionToken],
    queryFn: () => api.fetchSessionState(sessionToken),
    staleTime: 15_000,
  });

  const switchRoleMutation = useMutation({
    mutationFn: (role: AppRole) => api.switchActiveRole(role, sessionToken),
    onSuccess: (value) => {
      queryClient.setQueryData(["session-state", sessionToken], value);
    },
  });

  const setSessionToken = (token: string | null) => {
    setStoredSessionToken(token);
    setSessionTokenState(token);
    void queryClient.invalidateQueries({ queryKey: ["session-state"] });
  };

  const refreshSession = async () => {
    await queryClient.invalidateQueries({ queryKey: ["session-state"] });
  };

  const signOut = async () => {
    await api.signOut(sessionToken).catch(() => undefined);
    clearStoredSessionToken();
    setSessionTokenState(null);
    queryClient.removeQueries({ queryKey: ["session-state"] });
    queryClient.removeQueries({ queryKey: ["customer-order"] });
    queryClient.removeQueries({ queryKey: ["driver-dashboard"] });
  };

  const value = useMemo<SessionContextValue>(
    () => ({
      isLoading: sessionQuery.isLoading || switchRoleMutation.isPending,
      session: sessionQuery.data?.session ?? null,
      providers: sessionQuery.data?.providers ?? {
        googleEnabled: false,
        magicLinkEnabled: true,
      },
      sessionToken,
      setSessionToken,
      refreshSession,
      switchRole: async (role) => {
        await switchRoleMutation.mutateAsync(role);
      },
      signOut,
    }),
    [sessionQuery.data, sessionQuery.isLoading, sessionToken, switchRoleMutation.isPending],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession must be used within SessionProvider.");
  }

  return value;
};
