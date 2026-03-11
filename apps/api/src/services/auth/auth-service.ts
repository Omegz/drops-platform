import type {
  MagicLinkRequest,
  MagicLinkResponse,
  SessionState,
  User,
} from "@drops/contracts";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/http-error.js";
import {
  createPlainToken,
  createSignedState,
  hashToken,
  normalizeEmail,
  parseSignedState,
  sanitizeRedirectPath,
} from "../../lib/auth-tokens.js";
import type { RoleService } from "./role-service.js";
import type { AuthRepository, ResolvedSession } from "./repository.js";

const magicLinkLifetimeMs = 1000 * 60 * 20;
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;
const googleUserInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly roleService: RoleService,
  ) {}

  async requestMagicLink(input: MagicLinkRequest): Promise<MagicLinkResponse> {
    const user = await this.repository.upsertUser(
      normalizeEmail(input.email),
      input.name,
    );
    const token = createPlainToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + magicLinkLifetimeMs).toISOString();

    await this.repository.createMagicLink({
      userId: user.id,
      email: user.email,
      tokenHash,
      redirectPath: sanitizeRedirectPath(input.redirectPath),
      expiresAt,
    });

    const verifyUrl = `${env.apiBaseUrl.replace(/\/$/, "")}/api/auth/magic-links/verify?token=${token}`;

    if (env.resendApiKey && env.resendFromEmail) {
      await this.sendMagicLinkEmail(user.email, verifyUrl);
      return {
        delivery: "email",
        expiresAt,
      };
    }

    return {
      delivery: "preview",
      previewUrl: verifyUrl,
      expiresAt,
    };
  }

  async verifyMagicLink(token: string) {
    const tokenHash = await hashToken(token);
    const consumed = await this.repository.consumeMagicLink(tokenHash);

    if (!consumed) {
      throw new AppError(400, "INVALID_MAGIC_LINK", "Magic link is invalid or expired.");
    }

    await this.repository.linkDriverAccountForUser(consumed.user.id, consumed.user.email);
    return this.createSessionRedirect(consumed.user, consumed.redirectPath);
  }

  async beginGoogleSignIn(redirectPath: string | null | undefined) {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new AppError(
        503,
        "GOOGLE_AUTH_NOT_CONFIGURED",
        "Google OAuth is not configured for this deployment.",
      );
    }

    const state = await createSignedState(
      {
        redirectPath: sanitizeRedirectPath(redirectPath),
      },
      env.authStateSecret,
    );
    const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authorizeUrl.searchParams.set("client_id", env.googleClientId);
    authorizeUrl.searchParams.set("redirect_uri", this.getGoogleRedirectUri());
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid email profile");
    authorizeUrl.searchParams.set("prompt", "select_account");
    authorizeUrl.searchParams.set("state", state);

    return authorizeUrl.toString();
  }

  async verifyGoogleCallback(code: string, state: string | undefined) {
    if (!code) {
      throw new AppError(
        400,
        "INVALID_GOOGLE_CALLBACK",
        "Google did not return an authorization code.",
      );
    }

    const redirectState = await parseSignedState<{ redirectPath?: string }>(
      state,
      env.authStateSecret,
    );
    const redirectPath = sanitizeRedirectPath(redirectState?.redirectPath);
    const googleProfile = await this.fetchGoogleProfile(code);

    if (!googleProfile.email || !googleProfile.email_verified) {
      throw new AppError(
        400,
        "GOOGLE_EMAIL_REQUIRED",
        "Google sign-in requires a verified email address.",
      );
    }

    const user = await this.repository.upsertUser(
      normalizeEmail(googleProfile.email),
      googleProfile.name,
    );

    await this.repository.linkDriverAccountForUser(user.id, user.email);

    return this.createSessionRedirect(user, redirectPath);
  }

  async resolveSession(sessionToken: string | null | undefined): Promise<ResolvedSession | null> {
    if (!sessionToken) {
      return null;
    }

    const sessionTokenHash = await hashToken(sessionToken);
    return this.repository.getSessionByTokenHash(sessionTokenHash);
  }

  async getSessionState(sessionToken: string | null | undefined): Promise<SessionState> {
    return this.roleService.toSessionState(await this.resolveSession(sessionToken));
  }

  async signOut(sessionToken: string | null | undefined) {
    if (!sessionToken) {
      return { ok: true };
    }

    const sessionTokenHash = await hashToken(sessionToken);
    await this.repository.deleteSessionByTokenHash(sessionTokenHash);
    return { ok: true };
  }

  private async sendMagicLinkEmail(email: string, verifyUrl: string) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.resendApiKey!}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.resendFromEmail!,
        to: [email],
        subject: "Your Drops sign-in link",
        html: `<p>Use this secure link to sign in:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
      }),
    });

    if (!response.ok) {
      throw new AppError(502, "MAGIC_LINK_DELIVERY_FAILED", "Failed to deliver magic link email.");
    }
  }

  private async createSessionRedirect(user: User, redirectPath: string | null | undefined) {
    const sessionToken = createPlainToken();
    const sessionTokenHash = await hashToken(sessionToken);
    await this.repository.createSession({
      userId: user.id,
      tokenHash: sessionTokenHash,
      activeRole: "customer",
      expiresAt: new Date(Date.now() + sessionLifetimeMs).toISOString(),
    });

    const redirectUrl = new URL(`${env.appBaseUrl.replace(/\/$/, "")}/auth/callback`);
    redirectUrl.searchParams.set("sessionToken", sessionToken);
    redirectUrl.searchParams.set("next", sanitizeRedirectPath(redirectPath));

    return {
      redirectUrl: redirectUrl.toString(),
      sessionToken,
    };
  }

  private async fetchGoogleProfile(code: string) {
    const tokenResponse = await fetch(googleTokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: env.googleClientId!,
        client_secret: env.googleClientSecret!,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.getGoogleRedirectUri(),
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new AppError(
        502,
        "GOOGLE_TOKEN_EXCHANGE_FAILED",
        "Failed to exchange the Google authorization code.",
      );
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new AppError(
        502,
        "GOOGLE_ACCESS_TOKEN_MISSING",
        "Google did not return an access token.",
      );
    }

    const profileResponse = await fetch(googleUserInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new AppError(
        502,
        "GOOGLE_PROFILE_FETCH_FAILED",
        "Failed to load the Google user profile.",
      );
    }

    return (await profileResponse.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
  }

  private getGoogleRedirectUri() {
    return `${env.apiBaseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  }
}
