import type { MagicLinkRequest, MagicLinkResponse, SessionState } from "@drops/contracts";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/http-error.js";
import { createPlainToken, hashToken, normalizeEmail } from "../../lib/auth-tokens.js";
import type { RoleService } from "./role-service.js";
import type { AuthRepository, ResolvedSession } from "./repository.js";

const magicLinkLifetimeMs = 1000 * 60 * 20;
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

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
      redirectPath: input.redirectPath,
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

    const sessionToken = createPlainToken();
    const sessionTokenHash = await hashToken(sessionToken);
    await this.repository.createSession({
      userId: consumed.user.id,
      tokenHash: sessionTokenHash,
      activeRole: "customer",
      expiresAt: new Date(Date.now() + sessionLifetimeMs).toISOString(),
    });

    const redirectUrl = new URL(
      `${env.appBaseUrl.replace(/\/$/, "")}/auth/callback`,
    );
    redirectUrl.searchParams.set("sessionToken", sessionToken);
    if (consumed.redirectPath) {
      redirectUrl.searchParams.set("next", consumed.redirectPath);
    }

    return {
      redirectUrl: redirectUrl.toString(),
      sessionToken,
    };
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
}
