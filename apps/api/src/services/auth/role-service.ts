import type { AppRole, AppSession, SessionState } from "@drops/contracts";
import { AppError } from "../../lib/http-error.js";
import { env } from "../../lib/env.js";
import type { AuthRepository, ResolvedSession } from "./repository.js";

const providerState = {
  googleEnabled: Boolean(env.googleClientId && env.googleClientSecret),
  magicLinkEnabled: true,
};

const adminEmails = new Set(
  (env.adminEmails ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export class RoleService {
  constructor(private readonly repository: AuthRepository) {}

  async getAvailableRoles(userId: string, email: string): Promise<AppRole[]> {
    const roles = new Set<AppRole>(["customer"]);
    const driverId = await this.repository.getDriverIdForUser(userId, email);
    if (driverId) {
      roles.add("driver");
    }
    if (adminEmails.has(email.toLowerCase())) {
      roles.add("admin");
    }
    return Array.from(roles);
  }

  async toSessionState(resolved: ResolvedSession | null): Promise<SessionState> {
    if (!resolved) {
      return {
        session: null,
        providers: providerState,
      };
    }

    const availableRoles = await this.getAvailableRoles(resolved.user.id, resolved.user.email);
    const activeRole = availableRoles.includes(resolved.session.activeRole)
      ? resolved.session.activeRole
      : "customer";

    const session: AppSession = {
      user: resolved.user,
      availableRoles,
      activeRole,
      isAuthenticated: true,
      providers: providerState,
    };

    if (activeRole !== resolved.session.activeRole) {
      await this.repository.updateSessionRole(resolved.session.id, activeRole);
    }

    return {
      session,
      providers: providerState,
    };
  }

  async switchActiveRole(resolved: ResolvedSession, role: AppRole) {
    const availableRoles = await this.getAvailableRoles(resolved.user.id, resolved.user.email);
    if (!availableRoles.includes(role)) {
      throw new AppError(403, "ROLE_NOT_AVAILABLE", `Role ${role} is not available for this user.`);
    }

    await this.repository.updateSessionRole(resolved.session.id, role);
    return this.toSessionState({
      ...resolved,
      session: {
        ...resolved.session,
        activeRole: role,
      },
    });
  }

  async requireDriverId(resolved: ResolvedSession) {
    const driverId = await this.repository.getDriverIdForUser(
      resolved.user.id,
      resolved.user.email,
    );

    if (!driverId) {
      throw new AppError(403, "DRIVER_ROLE_REQUIRED", "Current user is not linked to a driver account.");
    }

    return driverId;
  }

  async requireAdmin(resolved: ResolvedSession) {
    const roles = await this.getAvailableRoles(resolved.user.id, resolved.user.email);
    if (!roles.includes("admin")) {
      throw new AppError(403, "ADMIN_ROLE_REQUIRED", "Admin access is required.");
    }
  }
}
