import { z } from "zod";

export const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const BoundsSchema = z.object({
  northEast: CoordinateSchema,
  southWest: CoordinateSchema,
});

export const AddressPointSchema = z.object({
  addressLine: z.string().min(3).max(280),
  instructions: z.string().max(500).optional(),
  point: CoordinateSchema,
});

export const AppRoleSchema = z.enum(["customer", "driver", "admin"]);
export const DriverAvailabilitySchema = z.enum(["offline", "online"]);
export const OrderStatusSchema = z.enum([
  "pending_assignment",
  "offer_sent",
  "accepted",
  "on_the_way",
  "picked_up",
  "dropped_off",
  "cancelled",
  "no_driver_found",
]);
export const OfferStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "expired",
]);
export const InvitationStatusSchema = z.enum(["pending", "approved"]);
export const ActiveLegSchema = z.enum([
  "unassigned",
  "to_pickup",
  "to_dropoff",
  "completed",
]);

export const AuthProviderStatusSchema = z.object({
  googleEnabled: z.boolean(),
  magicLinkEnabled: z.boolean(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export const AppSessionSchema = z.object({
  user: UserSchema,
  availableRoles: z.array(AppRoleSchema),
  activeRole: AppRoleSchema,
  isAuthenticated: z.literal(true),
  providers: AuthProviderStatusSchema,
});

export const SessionStateSchema = z.object({
  session: AppSessionSchema.nullable(),
  providers: AuthProviderStatusSchema,
});

export const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120).optional(),
  redirectPath: z.string().min(1).max(300).optional(),
});

export const MagicLinkResponseSchema = z.object({
  delivery: z.enum(["email", "preview"]),
  previewUrl: z.string().url().optional(),
  expiresAt: z.string().datetime(),
});

export const SwitchActiveRoleSchema = z.object({
  role: AppRoleSchema,
});

export const CreateDriverInvitationSchema = z.object({
  email: z.string().email(),
  driverName: z.string().min(2).max(120),
  vehicleLabel: z.string().min(2).max(120),
});

export const DriverInvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  driverName: z.string(),
  vehicleLabel: z.string(),
  status: InvitationStatusSchema,
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
});

export const DriverSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  email: z.string().email().optional(),
  name: z.string(),
  phoneNumber: z.string().optional(),
  vehicleLabel: z.string(),
  availability: DriverAvailabilitySchema,
  activeOrderCount: z.number().int().min(0),
  lastKnownLocation: CoordinateSchema.nullable(),
  lastLocationAt: z.string().datetime().nullable(),
});

export const DriverLocationUpdateSchema = z.object({
  point: CoordinateSchema,
  accuracyMeters: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speedKph: z.number().min(0).optional(),
  batteryLevel: z.number().min(0).max(1).optional(),
});

export const DriverDeviceRegistrationSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("expo"),
    expoPushToken: z.string().min(6),
  }),
  z.object({
    platform: z.literal("web"),
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(8),
      auth: z.string().min(8),
    }),
  }),
]);

export const CreateOrderSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerPhoneNumber: z.string().min(6).max(40).optional(),
  pickup: AddressPointSchema,
  dropoff: AddressPointSchema,
  notes: z.string().max(500).optional(),
  priority: z.enum(["normal", "priority"]).default("normal"),
  customerWebhookUrl: z.string().url().optional(),
});

export const DispatchCandidateSchema = z.object({
  driverId: z.string(),
  distanceKm: z.number().min(0),
  activeOrderCount: z.number().int().min(0),
  score: z.number(),
  rationale: z.string(),
});

export const OrderEventSchema = z.object({
  orderId: z.string(),
  status: OrderStatusSchema,
  happenedAt: z.string().datetime(),
  note: z.string().optional(),
});

export const RouteGeometrySchema = z.object({
  provider: z.string(),
  etaMinutes: z.number().min(0).nullable(),
  distanceKm: z.number().min(0).nullable(),
  points: z.array(CoordinateSchema).min(2),
});

export const MapStopSchema = z.object({
  kind: z.enum(["pickup", "dropoff", "driver"]),
  label: z.string(),
  point: CoordinateSchema,
});

export const TaskMapSchema = z.object({
  activeLeg: ActiveLegSchema,
  etaMinutes: z.number().min(0).nullable(),
  primaryStop: MapStopSchema.nullable(),
  secondaryStop: MapStopSchema.nullable(),
  route: RouteGeometrySchema.nullable(),
  bounds: BoundsSchema.nullable(),
});

export const OrderSchema = z.object({
  id: z.string(),
  customerUserId: z.string().nullable(),
  customerName: z.string(),
  customerPhoneNumber: z.string().optional(),
  pickup: AddressPointSchema,
  dropoff: AddressPointSchema,
  notes: z.string().optional(),
  priority: z.enum(["normal", "priority"]),
  status: OrderStatusSchema,
  assignedDriverId: z.string().nullable(),
  trackingToken: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  customerWebhookUrl: z.string().url().optional(),
});

export const DispatchDecisionSchema = z.object({
  order: OrderSchema,
  selectedOffer: DispatchCandidateSchema.nullable(),
  sentOfferDriverIds: z.array(z.string()),
  alternatives: z.array(DispatchCandidateSchema),
});

export const OfferSchema = z.object({
  orderId: z.string(),
  driverId: z.string(),
  status: OfferStatusSchema,
  score: z.number(),
  pickupDistanceKm: z.number().min(0),
  pickup: AddressPointSchema,
  dropoff: AddressPointSchema,
  offeredAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const OfferDecisionSchema = z.object({
  decision: z.enum(["accept", "reject"]),
});

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(["accepted", "on_the_way", "picked_up", "dropped_off", "cancelled"]),
  note: z.string().max(500).optional(),
});

export const TrackingDriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  vehicleLabel: z.string(),
  phoneNumber: z.string().optional(),
  point: CoordinateSchema.nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export const TrackingSnapshotSchema = z.object({
  orderId: z.string(),
  status: OrderStatusSchema,
  trackingUrl: z.string().url(),
  pickup: AddressPointSchema,
  dropoff: AddressPointSchema,
  driver: TrackingDriverSchema.nullable(),
  timeline: z.array(OrderEventSchema),
  map: TaskMapSchema,
});

export const NavigationLinksSchema = z.object({
  toPickup: z.string().url(),
  toDropoff: z.string().url(),
});

export const ActiveDriverAssignmentSchema = z.object({
  order: OrderSchema,
  tracking: TrackingSnapshotSchema,
  navigation: NavigationLinksSchema,
});

export const DriverDashboardSchema = z.object({
  driver: DriverSchema,
  offers: z.array(OfferSchema),
  activeAssignment: ActiveDriverAssignmentSchema.nullable(),
});

export const CustomerOrderViewSchema = z.object({
  order: OrderSchema,
  tracking: TrackingSnapshotSchema,
  shareUrl: z.string().url(),
});

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ApiEnvelopeSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: schema,
    requestId: z.string(),
  });

export type Coordinate = z.infer<typeof CoordinateSchema>;
export type Bounds = z.infer<typeof BoundsSchema>;
export type AddressPoint = z.infer<typeof AddressPointSchema>;
export type AppRole = z.infer<typeof AppRoleSchema>;
export type AuthProviderStatus = z.infer<typeof AuthProviderStatusSchema>;
export type User = z.infer<typeof UserSchema>;
export type AppSession = z.infer<typeof AppSessionSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;
export type MagicLinkResponse = z.infer<typeof MagicLinkResponseSchema>;
export type SwitchActiveRoleInput = z.infer<typeof SwitchActiveRoleSchema>;
export type CreateDriverInvitationInput = z.infer<typeof CreateDriverInvitationSchema>;
export type DriverInvitation = z.infer<typeof DriverInvitationSchema>;
export type Driver = z.infer<typeof DriverSchema>;
export type DriverAvailability = z.infer<typeof DriverAvailabilitySchema>;
export type DriverLocationUpdate = z.infer<typeof DriverLocationUpdateSchema>;
export type DriverDeviceRegistration = z.infer<typeof DriverDeviceRegistrationSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type DispatchCandidate = z.infer<typeof DispatchCandidateSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type DispatchDecision = z.infer<typeof DispatchDecisionSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type OfferDecision = z.infer<typeof OfferDecisionSchema>;
export type OfferStatus = z.infer<typeof OfferStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderEvent = z.infer<typeof OrderEventSchema>;
export type OrderStatusUpdate = z.infer<typeof OrderStatusUpdateSchema>;
export type TrackingDriver = z.infer<typeof TrackingDriverSchema>;
export type RouteGeometry = z.infer<typeof RouteGeometrySchema>;
export type MapStop = z.infer<typeof MapStopSchema>;
export type TaskMap = z.infer<typeof TaskMapSchema>;
export type ActiveLeg = z.infer<typeof ActiveLegSchema>;
export type TrackingSnapshot = z.infer<typeof TrackingSnapshotSchema>;
export type NavigationLinks = z.infer<typeof NavigationLinksSchema>;
export type ActiveDriverAssignment = z.infer<typeof ActiveDriverAssignmentSchema>;
export type DriverDashboard = z.infer<typeof DriverDashboardSchema>;
export type CustomerOrderView = z.infer<typeof CustomerOrderViewSchema>;
