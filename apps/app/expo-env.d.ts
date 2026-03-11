/// <reference types="expo/types" />

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DRIVER_ID?: string;
    EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY?: string;
  }
}
