import { Platform } from "react-native";

const SESSION_TOKEN_KEY = "drops.session.token";

let nativeFallbackToken: string | null = null;

export const getStoredSessionToken = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  }

  return nativeFallbackToken;
};

export const setStoredSessionToken = (token: string | null) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }

  nativeFallbackToken = token;
};

export const clearStoredSessionToken = () => {
  setStoredSessionToken(null);
};

export const createAuthHeaders = (token = getStoredSessionToken()) =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
