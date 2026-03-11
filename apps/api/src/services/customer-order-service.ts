import type {
  CreateOrderInput,
  CreatePublicOrderInput,
  CustomerOrderView,
} from "@drops/contracts";
import type { ResolvedSession } from "./auth/repository.js";
import type { AuthRepository } from "./auth/repository.js";
import type { DispatchService } from "./dispatch-service.js";

export class CustomerOrderService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly dispatchService: DispatchService,
  ) {}

  async createOrderForSession(
    session: ResolvedSession,
    input: CreateOrderInput,
  ): Promise<CustomerOrderView> {
    const decision = await this.dispatchService.createOrder(input);
    await this.authRepository.attachOrderOwner(decision.order.id, session.user.id);
    return this.dispatchService.getCustomerOrderView(decision.order.id, session.user.id);
  }

  async createPublicOrder(input: CreatePublicOrderInput): Promise<CustomerOrderView> {
    const decision = await this.dispatchService.createOrder({
      ...input,
      customerName: "Guest customer",
    });
    return this.dispatchService.getCustomerOrderView(decision.order.id, null);
  }

  async getCurrentOrder(session: ResolvedSession) {
    const orderId = await this.authRepository.getCurrentOrderIdForUser(session.user.id);
    if (!orderId) {
      return null;
    }
    return this.dispatchService.getCustomerOrderView(orderId, session.user.id);
  }

  async getOrderById(session: ResolvedSession, orderId: string) {
    await this.authRepository.assertOrderOwner(session.user.id, orderId);
    return this.dispatchService.getCustomerOrderView(orderId, session.user.id);
  }

  async getPublicOrder(orderId: string) {
    return this.dispatchService.getCustomerOrderView(orderId, null);
  }
}
