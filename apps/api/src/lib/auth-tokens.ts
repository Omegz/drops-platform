const encoder = new TextEncoder();

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const createPlainToken = () =>
  `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;

export const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

export const sanitizeRedirectPath = (
  value: string | null | undefined,
  fallback = "/customer",
) => {
  if (!value) {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
};

export const createSignedState = async (
  payload: Record<string, unknown>,
  secret: string,
) => {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await hashToken(`${secret}:${encodedPayload}`);
  return `${encodedPayload}.${signature}`;
};

export const parseSignedState = async <T>(
  value: string | null | undefined,
  secret: string,
): Promise<T | null> => {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await hashToken(`${secret}:${encodedPayload}`);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(encodedPayload)) as T;
  } catch {
    return null;
  }
};
