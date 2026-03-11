import type { CreateDriverInvitationInput } from "@drops/contracts";
import type { AuthRepository, ResolvedSession } from "./auth/repository.js";
import type { RoleService } from "./auth/role-service.js";

export class DriverInvitationService {
  constructor(
    private readonly roleService: RoleService,
    private readonly authRepository: AuthRepository,
  ) {}

  async createInvitation(session: ResolvedSession, input: CreateDriverInvitationInput) {
    await this.roleService.requireAdmin(session);
    return this.authRepository.createDriverInvitation(input, session.user.id);
  }

  async approveInvitation(session: ResolvedSession, invitationId: string) {
    await this.roleService.requireAdmin(session);
    return this.authRepository.approveDriverInvitation(invitationId);
  }
}
