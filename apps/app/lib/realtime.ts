import { Platform } from "react-native";

export const bindWebEventSource = (
  subscribeUrl: string | null | undefined,
  onMessage: () => void,
) => {
  if (Platform.OS !== "web" || !subscribeUrl) {
    return () => undefined;
  }

  const source = new EventSource(subscribeUrl);
  source.onmessage = () => {
    onMessage();
  };
  source.onerror = () => {
    source.close();
  };

  return () => {
    source.close();
  };
};
