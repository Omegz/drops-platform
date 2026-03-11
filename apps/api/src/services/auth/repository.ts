import type { AppRole, CreateDriverInvitationInput, DriverInvitation, User } from "@drops/contracts";
import { CloudflareD1Client } from "../../db/d1-client.js";
import { AppError } from "../../lib/http-error.js";
import { createId } from "../../lib/id.js";
import { normalizeEmail } from "../../lib/auth-tokens.js";

const nowIso = () => new Date().toISOString();
const activeOrderStatuses = ["pending_assignment", "offer_sent", "accepted", "on_the_way", "picked_up"] as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  active_role: AppRole;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type MagicLinkRow = {
  id: string;
  user_id: string;
  email: string;
  token_hash: string;
  redirect_path: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

type DriverAccountRow = {
  id: string;
  driver_id: string;
  email: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  driver_name: string;
  vehicle_label: string;
  invited_by_user_id: string;
  status: "pending" | "approved";
  created_at: string;
  approved_at: string | null;
};

type SessionRecord = {
  id: string;
  tokenHash: string;
  activeRole: AppRole;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedSession = {
  user: User;
  session: SessionRecord;
};

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatarUrl: row.avatar_url ?? undefined,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

const toInvitation = (row: InvitationRow): DriverInvitation => ({
  id: row.id,
  email: row.email,
  driverName: row.driver_name,
  vehicleLabel: row.vehicle_label,
  status: row.status,
  createdAt: row.created_at,
  approvedAt: row.approved_at,
});

export interface AuthRepository {
  upsertUser(email: string, name?: string): Promise<User>;
  getUserById(userId: string): Promise<User | null>;
  createMagicLink(input: {
    userId: string;
    email: string;
    tokenHash: string;
    redirectPath?: string;
    expiresAt: string;
  }): Promise<void>;
  consumeMagicLink(tokenHash: string): Promise<{ user: User; redirectPath: string | null; expiresAt: string } | null>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    activeRole: AppRole;
    expiresAt: string;
  }): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<ResolvedSession | null>;
  updateSessionRole(sessionId: string, role: AppRole): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  getDriverIdForUser(userId: string, email: string): Promise<string | null>;
  linkDriverAccountForUser(userId: string, email: string): Promise<string | null>;
  createDriverInvitation(input: CreateDriverInvitationInput, invitedByUserId: string): Promise<DriverInvitation>;
  approveDriverInvitation(invitationId: string): Promise<DriverInvitation>;
  attachOrderOwner(orderId: string, userId: string): Promise<void>;
  getCurrentOrderIdForUser(userId: string): Promise<string | null>;
  assertOrderOwner(userId: string, orderId: string): Promise<void>;
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersById = new Map<string, User>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly magicLinks = new Map<string, { userId: string; redirectPath: string | null; expiresAt: string; usedAt: string | null }>();
  private readonly sessions = new Map<string, { userId: string; role: AppRole; expiresAt: string; sessionId: string; updatedAt: string; createdAt: string }>();
  private readonly driverAccounts = new Map<string, { driverId: string; userId: string | null }>();
  private readonly invitations = new Map<string, DriverInvitation>();
  private readonly orderOwners = new Map<string, string>();
  private readonly ordersByUser = new Map<string, string[]>();

  constructor() {
    [
      ["driver_demo_01@drops.app", "driver_demo_01"],
      ["driver_demo_02@drops.app", "driver_demo_02"],
      ["driver_demo_03@drops.app", "driver_demo_03"],
    ].forEach(([email, driverId]) => {
      this.driverAccounts.set(email, { driverId, userId: null });
    });
  }

  async upsertUser(email: string, name?: string) {
    const normalized = normalizeEmail(email);
    const existingId = this.userIdByEmail.get(normalized);

    if (existingId) {
      const existing = this.usersById.get(existingId)!;
      const updated: User = {
        ...existing,
        name: name?.trim() || existing.name,
      };
      this.usersById.set(existing.id, updated);
      return updated;
    }

    const user: User = {
      id: createId("usr"),
      email: normalized,
      name: name?.trim() || normalized.split("@")[0] || "Dispatch User",
      createdAt: nowIso(),
      lastLoginAt: null,
    };
    this.usersById.set(user.id, user);
    this.userIdByEmail.set(normalized, user.id);
    return user;
  }

  async getUserById(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async createMagicLink(input: { userId: string; email: string; tokenHash: string; redirectPath?: string; expiresAt: string }) {
    this.magicLinks.set(input.tokenHash, {
      userId: input.userId,
      redirectPath: input.redirectPath ?? null,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
  }

  async consumeMagicLink(tokenHash: string) {
    const magic = this.magicLinks.get(tokenHash);

    if (!magic || magic.usedAt || new Date(magic.expiresAt).getTime() < Date.now()) {
      return null;
    }

    magic.usedAt = nowIso();
    const user = this.usersById.get(magic.userId);
    if (!user) {
      return null;
    }

    const updatedUser = {
      ...user,
      lastLoginAt: nowIso(),
    };
    this.usersById.set(user.id, updatedUser);

    return {
      user: updatedUser,
      redirectPath: magic.redirectPath,
      expiresAt: magic.expiresAt,
    };
  }

  async createSession(input: { userId: string; tokenHash: string; activeRole: AppRole; expiresAt: string }) {
    this.sessions.set(input.tokenHash, {
      userId: input.userId,
      role: input.activeRole,
      expiresAt: input.expiresAt,
      sessionId: createId("ses"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async getSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }

    const user = this.usersById.get(session.userId);
    if (!user) {
      return null;
    }

    return {
      user,
      session: {
        id: session.sessionId,
        tokenHash,
        activeRole: session.role,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    };
  }

  async updateSessionRole(sessionId: string, role: AppRole) {
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (session.sessionId === sessionId) {
        this.sessions.set(tokenHash, {
          ...session,
          role,
          updatedAt: nowIso(),
        });
        return;
      }
    }
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async getDriverIdForUser(userId: string, email: string) {
    for (const [accountEmail, account] of this.driverAccounts.entries()) {
      if (account.userId === userId || accountEmail === normalizeEmail(email)) {
        return account.driverId;
      }
    }

    return null;
  }

  async linkDriverAccountForUser(userId: string, email: string) {
    const normalized = normalizeEmail(email);
    const account = this.driverAccounts.get(normalized);
    if (!account) {
      return null;
    }

    this.driverAccounts.set(normalized, { ...account, userId });
    return account.driverId;
  }

  async createDriverInvitation(input: CreateDriverInvitationInput, _invitedByUserId: string) {
    const invitation: DriverInvitation = {
      id: createId("inv"),
      email: normalizeEmail(input.email),
      driverName: input.driverName,
      vehicleLabel: input.vehicleLabel,
      status: "pending",
      createdAt: nowIso(),
      approvedAt: null,
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async approveDriverInvitation(invitationId: string) {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new AppError(404, "INVITATION_NOT_FOUND", "Driver invitation was not found.");
    }

    const approved: DriverInvitation = {
      ...invitation,
      status: "approved",
      approvedAt: nowIso(),
    };
    this.invitations.set(invitationId, approved);
    this.driverAccounts.set(approved.email, {
      driverId: createId("drv"),
      userId: null,
    });
    return approved;
  }

  async attachOrderOwner(orderId: string, userId: string) {
    this.orderOwners.set(orderId, userId);
    const nextOrders = [...(this.ordersByUser.get(userId) ?? []), orderId];
    this.ordersByUser.set(userId, nextOrders);
  }

  async getCurrentOrderIdForUser(userId: string) {
    const orders = this.ordersByUser.get(userId) ?? [];
    return orders.at(-1) ?? null;
  }

  async assertOrderOwner(userId: string, orderId: string) {
    if (this.orderOwners.get(orderId) !== userId) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found for the current user.");
    }
  }
}

export class D1AuthRepository implements AuthRepository {
  constructor(private readonly d1: CloudflareD1Client) {}

  async upsertUser(email: string, name?: string) {
    const normalized = normalizeEmail(email);
    const existing = await this.d1.queryOne<UserRow>(
      `SELECT * FROM users WHERE email = ?`,
      [normalized],
    );

    if (existing) {
      const nextName = name?.trim() || existing.name;
      await this.d1.execute(
        `UPDATE users SET name = ?, updated_at = ? WHERE id = ?`,
        [nextName, nowIso(), existing.id],
      );
      return {
        ...toUser(existing),
        name: nextName,
      };
    }

    const user: User = {
      id: createId("usr"),
      email: normalized,
      name: name?.trim() || normalized.split("@")[0] || "Dispatch User",
      createdAt: nowIso(),
      lastLoginAt: null,
    };

    await this.d1.execute(
      `
        INSERT INTO users (id, email, name, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [user.id, user.email, user.name, user.createdAt, user.createdAt, null],
    );

    return user;
  }

  async getUserById(userId: string) {
    const row = await this.d1.queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [userId]);
    return row ? toUser(row) : null;
  }

  async createMagicLink(input: { userId: string; email: string; tokenHash: string; redirectPath?: string; expiresAt: string }) {
    await this.d1.execute(
      `
        INSERT INTO magic_links (id, user_id, email, token_hash, redirect_path, expires_at, used_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        createId("ml"),
        input.userId,
        normalizeEmail(input.email),
        input.tokenHash,
        input.redirectPath ?? null,
        input.expiresAt,
        null,
        nowIso(),
      ],
    );
  }

  async consumeMagicLink(tokenHash: string) {
    const row = await this.d1.queryOne<MagicLinkRow>(
      `SELECT * FROM magic_links WHERE token_hash = ?`,
      [tokenHash],
    );

    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    await this.d1.batch([
      {
        sql: `UPDATE magic_links SET used_at = ? WHERE id = ?`,
        params: [nowIso(), row.id],
      },
      {
        sql: `UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`,
        params: [nowIso(), nowIso(), row.user_id],
      },
    ]);

    const user = await this.getUserById(row.user_id);
    if (!user) {
      return null;
    }

    return {
      user,
      redirectPath: row.redirect_path,
      expiresAt: row.expires_at,
    };
  }

  async createSession(input: { userId: string; tokenHash: string; activeRole: AppRole; expiresAt: string }) {
    const now = nowIso();
    await this.d1.execute(
      `
        INSERT INTO auth_sessions (id, user_id, token_hash, active_role, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [createId("ses"), input.userId, input.tokenHash, input.activeRole, input.expiresAt, now, now],
    );
  }

  async getSessionByTokenHash(tokenHash: string) {
    const row = await this.d1.queryOne<SessionRow>(
      `SELECT * FROM auth_sessions WHERE token_hash = ?`,
      [tokenHash],
    );

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }

    const user = await this.getUserById(row.user_id);
    if (!user) {
      return null;
    }

    return {
      user,
      session: {
        id: row.id,
        tokenHash,
        activeRole: row.active_role,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  }

  async updateSessionRole(sessionId: string, role: AppRole) {
    await this.d1.execute(
      `UPDATE auth_sessions SET active_role = ?, updated_at = ? WHERE id = ?`,
      [role, nowIso(), sessionId],
    );
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    await this.d1.execute(`DELETE FROM auth_sessions WHERE token_hash = ?`, [tokenHash]);
  }

  async getDriverIdForUser(userId: string, email: string) {
    const normalized = normalizeEmail(email);
    const row = await this.d1.queryOne<DriverAccountRow>(
      `SELECT * FROM driver_accounts WHERE user_id = ? OR email = ?`,
      [userId, normalized],
    );
    return row?.driver_id ?? null;
  }

  async linkDriverAccountForUser(userId: string, email: string) {
    const normalized = normalizeEmail(email);
    const row = await this.d1.queryOne<DriverAccountRow>(
      `SELECT * FROM driver_accounts WHERE email = ?`,
      [normalized],
    );

    if (!row) {
      return null;
    }

    await this.d1.execute(
      `UPDATE driver_accounts SET user_id = ?, updated_at = ? WHERE id = ?`,
      [userId, nowIso(), row.id],
    );

    return row.driver_id;
  }

  async createDriverInvitation(input: CreateDriverInvitationInput, invitedByUserId: string) {
    const normalized = normalizeEmail(input.email);
    const invitation: DriverInvitation = {
      id: createId("inv"),
      email: normalized,
      driverName: input.driverName,
      vehicleLabel: input.vehicleLabel,
      status: "pending",
      createdAt: nowIso(),
      approvedAt: null,
    };

    await this.d1.execute(
      `
        INSERT OR REPLACE INTO driver_invitations (
          id, email, driver_name, vehicle_label, invited_by_user_id, status, created_at, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        invitation.id,
        invitation.email,
        invitation.driverName,
        invitation.vehicleLabel,
        invitedByUserId,
        invitation.status,
        invitation.createdAt,
        invitation.approvedAt,
      ],
    );

    return invitation;
  }

  async approveDriverInvitation(invitationId: string) {
    const row = await this.d1.queryOne<InvitationRow>(
      `SELECT * FROM driver_invitations WHERE id = ?`,
      [invitationId],
    );

    if (!row) {
      throw new AppError(404, "INVITATION_NOT_FOUND", "Driver invitation was not found.");
    }

    const approvedAt = nowIso();
    const existingAccount = await this.d1.queryOne<DriverAccountRow>(
      `SELECT * FROM driver_accounts WHERE email = ?`,
      [row.email],
    );

    if (!existingAccount) {
      const driverId = createId("drv");
      await this.d1.batch([
        {
          sql: `
            INSERT INTO drivers (
              id, name, phone_number, vehicle_label, availability, last_known_latitude, last_known_longitude,
              last_location_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            driverId,
            row.driver_name,
            null,
            row.vehicle_label,
            "offline",
            null,
            null,
            null,
            approvedAt,
            approvedAt,
          ],
        },
        {
          sql: `
            INSERT INTO driver_accounts (id, driver_id, email, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          params: [createId("drvacct"), driverId, row.email, null, approvedAt, approvedAt],
        },
      ]);
    }

    await this.d1.execute(
      `UPDATE driver_invitations SET status = 'approved', approved_at = ? WHERE id = ?`,
      [approvedAt, invitationId],
    );

    const approvedRow = await this.d1.queryOne<InvitationRow>(
      `SELECT * FROM driver_invitations WHERE id = ?`,
      [invitationId],
    );

    if (!approvedRow) {
      throw new AppError(500, "INVITATION_APPROVAL_FAILED", "Invitation approval failed.");
    }

    return toInvitation(approvedRow);
  }

  async attachOrderOwner(orderId: string, userId: string) {
    await this.d1.execute(
      `
        INSERT OR REPLACE INTO customer_order_owners (id, order_id, user_id, created_at)
        VALUES (?, ?, ?, ?)
      `,
      [createId("ordown"), orderId, userId, nowIso()],
    );
  }

  async getCurrentOrderIdForUser(userId: string) {
    const row = await this.d1.queryOne<{ order_id: string }>(
      `
        SELECT coo.order_id
        FROM customer_order_owners coo
        INNER JOIN orders o ON o.id = coo.order_id
        WHERE coo.user_id = ?
          AND o.status IN (${activeOrderStatuses.map((status) => `'${status}'`).join(", ")})
        ORDER BY o.created_at DESC
        LIMIT 1
      `,
      [userId],
    );

    return row?.order_id ?? null;
  }

  async assertOrderOwner(userId: string, orderId: string) {
    const row = await this.d1.queryOne<{ order_id: string }>(
      `SELECT order_id FROM customer_order_owners WHERE user_id = ? AND order_id = ?`,
      [userId, orderId],
    );

    if (!row) {
      throw new AppError(404, "ORDER_NOT_FOUND", "Order was not found for the current user.");
    }
  }
}
