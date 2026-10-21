/**
 * OPSKL CORE DOMAIN TYPES & DATABASE MODELS
 * Shared across Worker App, Organizer App, Admin Dashboard, and Supabase Services.
 */

export type UserRole = 'worker' | 'organizer' | 'admin';

export type ShiftCategory =
  | 'exhibition'
  | 'conference'
  | 'corporate'
  | 'activation'
  | 'support'
  | 'hospitality';

export type ShiftStatus =
  | 'draft'
  | 'open'
  | 'filling'
  | 'filled'
  | 'paused'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type ApplicationStatus =
  | 'applied'                          // Worker swiped / expressed interest
  | 'shortlisted'                      // Organizer reviewing
  | 'selected_awaiting_confirmation'   // Organizer selected, awaiting worker confirmation
  | 'confirmed'                        // Confirmed booking
  | 'rejected'                         // Organizer declined
  | 'withdrawn';                       // Worker cancelled prior to confirmation

export type BookingStatus =
  | 'selected_awaiting_confirmation'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'completed_awaiting_review'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'disputed';

export type PayoutStatus =
  | 'pending'
  | 'escrow_locked'
  | 'processing'
  | 'settled'
  | 'failed'
  | 'refunded';

export type VerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';

export interface Profile {
  id: string;
  role: UserRole;
  phone: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
  city: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerProfile {
  id: string;
  preferredLocality: string;
  serviceAreas: string[];
  skills: string[];
  experienceYears: number;
  bio?: string;
  availabilityStatus: 'available' | 'busy' | 'paused';
  profileCompletionStatus: 'incomplete' | 'completed';
  verificationStatus: VerificationStatus;
  rating: number;
  totalReviews: number;
  shiftsCompleted: number;
  upiId?: string;
  createdAt: string;
  updatedAt: string;
  profile?: Profile;
}

export interface OrganizerProfile {
  id: string;
  businessName: string;
  businessContactEmail?: string;
  businessContactPhone: string;
  gstin?: string;
  businessType: 'event_agency' | 'corporate' | 'venue_manager' | 'independent';
  billingAddress?: string;
  verificationStatus: VerificationStatus;
  profileCompletionStatus: 'incomplete' | 'completed';
  rating: number;
  totalEventsHosted: number;
  createdAt: string;
  updatedAt: string;
  profile?: Profile;
}

export interface OrganizerMembership {
  id: string;
  organizerId: string;
  userId: string;
  role: 'owner' | 'admin' | 'supervisor' | 'member';
  createdAt: string;
  user?: Profile;
}

export interface Job {
  id: string;
  organizerId: string;
  title: string;
  category: ShiftCategory;
  venueName: string;
  venueAddress: string;
  landmark?: string;
  city: string;
  zone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  hourlyRate: number;
  totalPay: number;
  slotsTotal: number;
  slotsFilled: number;
  dressCode?: string;
  duties: string[];
  perks?: string[];
  requiredSkills?: string[];
  eligibilityCriteria?: string;
  applicationDeadline?: string;
  breaksMinutes?: number;
  mealProvided?: boolean;
  transportProvided?: boolean;
  overtimePolicy?: string;
  latitude?: number;
  longitude?: number;
  reportingInstructions?: string;
  cancellationPolicy?: string;
  paymentDeadline?: string;
  supervisorName: string;
  supervisorPhone: string;
  status: ShiftStatus;
  createdAt: string;
  updatedAt: string;
  organizer?: OrganizerProfile;
}

export interface OrganizerMetrics {
  activeJobs: number;
  openPositions: number;
  newApplications: number;
  shortlistedApplicants: number;
  confirmedWorkers: number;
  upcomingEvents: number;
  completedShifts: number;
  totalStaffingSpend: number;
}

// Backward compatibility alias
export type Shift = Job;

export interface JobApplication {
  id: string;
  jobId: string;
  workerId: string;
  status: ApplicationStatus;
  appliedAt: string;
  notes?: string;
  worker?: WorkerProfile;
  job?: Job;
}

export type ShiftApplication = JobApplication;

export interface SavedJob {
  id: string;
  workerId: string;
  jobId: string;
  createdAt: string;
  job?: Job;
}

export interface SwipeEvent {
  id: string;
  workerId: string;
  jobId: string;
  direction: 'left' | 'right';
  createdAt: string;
}

export interface DiscoveryFeedFilters {
  category?: ShiftCategory | 'all';
  zone?: string;
  city?: string;
  minWage?: number;
  date?: string;
  requiredSkill?: string;
}

export interface DiscoveryFeedOptions {
  workerId?: string;
  filters?: DiscoveryFeedFilters;
  page?: number;
  pageSize?: number;
  includePassed?: boolean;
}

export interface DiscoveryFeedResult {
  jobs: Job[];
  totalCount: number;
  page: number;
  hasMore: boolean;
  error?: string;
}

export interface ApplicationResult {
  success: boolean;
  application?: JobApplication;
  errorCode?: string;
  errorMessage?: string;
}

export interface Booking {
  id: string;
  jobId: string;
  workerId: string;
  organizerId: string;
  status: BookingStatus;
  agreedHourlyRate: number;
  agreedTotalPay: number;
  checkInCode?: string;
  checkInTime?: string;
  checkOutTime?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  noShowReason?: string;
  disputeReason?: string;
  confirmedAt: string;
  completedAt?: string;
  notes?: string;
  job?: Job;
  worker?: WorkerProfile;
  organizer?: OrganizerProfile;
}

export interface AttendanceRecord {
  id: string;
  bookingId: string;
  jobId: string;
  workerId: string;
  supervisorId?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInCode?: string;
  hoursWorked?: number;
  verifiedBySupervisor: boolean;
  latitude?: number;
  longitude?: number;
  distanceToVenueKm?: number;
  notes?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  jobId: string;
  workerId: string;
  organizerId: string;
  amount: number;
  platformFee: number;
  netPayout: number;
  status: PayoutStatus;
  upiId: string;
  utrReference?: string;
  failureReason?: string;
  retryCount?: number;
  idempotencyKey?: string;
  providerPayoutId?: string;
  isSandbox?: boolean;
  escrowLockedAt: string;
  settledAt?: string;
  createdAt: string;
  jobTitle?: string;
  shiftHours?: number;
  venueName?: string;
  shiftDate?: string;
}

export type InvoiceStatus = 'draft' | 'pending' | 'escrow_funded' | 'settled' | 'overdue' | 'cancelled';

export interface OrganizerInvoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  organizerId: string;
  wageTotal: number;
  platformFee: number;
  gstRate: number;
  gstAmount: number;
  totalPayable: number;
  status: InvoiceStatus;
  paymentMethod: 'upi' | 'netbanking' | 'neft_rtgs' | 'corporate_card' | 'sandbox_mock';
  paymentProvider: 'razorpay' | 'cashfree' | 'sandbox' | 'manual_reconciliation';
  providerOrderId?: string;
  providerPaymentId?: string;
  dueDate: string;
  paidAt?: string;
  isSandbox: boolean;
  createdAt: string;
  updatedAt: string;
  jobTitle?: string;
  slotsCount?: number;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: 'razorpay' | 'cashfree' | 'sandbox';
  eventId: string;
  eventType: string;
  payload: Record<string, any>;
  status: 'pending' | 'processed' | 'failed' | 'duplicate';
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
}

export interface PaymentReconciliationLog {
  id: string;
  reconciliationType: 'payout' | 'invoice_collection' | 'refund' | 'reversal' | 'dispute_hold';
  referenceId: string;
  status: 'matched' | 'discrepancy' | 'resolved' | 'reversed';
  expectedAmount: number;
  recordedAmount: number;
  discrepancyAmount: number;
  notes?: string;
  actorId?: string;
  isSandbox: boolean;
  createdAt: string;
}

export interface WorkerEarningsSummary {
  confirmedUpcomingWages: number;
  completedAwaitingApproval: number;
  approvedAwaitingPayment: number;
  paidEarnings: number;
  failedDelayedPayments: number;
  disputedAmounts: number;
  totalEarnedAllTime: number;
  defaultUpiId: string;
  records: PaymentRecord[];
}

export interface OrganizerFinancesSummary {
  workerWageTotals: number;
  opskilServiceFees: number;
  applicableTaxes: number;
  totalPayableAllTime: number;
  settledAmount: number;
  outstandingEscrowDue: number;
  invoices: OrganizerInvoice[];
  reconciliationLogs: PaymentReconciliationLog[];
}

export interface Review {
  id: string;
  jobId: string;
  bookingId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export type NotificationType =
  | 'job_opportunity'
  | 'application_submitted'
  | 'application_shortlisted'
  | 'application_rejected'
  | 'worker_selected'
  | 'booking_confirmed'
  | 'shift_reminder'
  | 'shift_cancelled'
  | 'standby_callout'
  | 'check_in'
  | 'check_out'
  | 'attendance_approved'
  | 'payout_settled'
  | 'payout_failed'
  | 'dispute_update';

export type NotificationChannel = 'in_app' | 'expo_push' | 'whatsapp' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType | string;
  channel?: NotificationChannel;
  idempotencyKey?: string;
  deliveryStatus?: 'pending' | 'delivered' | 'failed' | 'suppressed';
  actionUrl?: string;
  priority?: NotificationPriority;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface UserNotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  notifyShiftOpportunities: boolean;
  notifyApplications: boolean;
  notifySelectionAndConfirmations: boolean;
  notifyShiftReminders: boolean;
  notifyAttendanceUpdates: boolean;
  notifyPayouts: boolean;
  notifyDisputes: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushTokenRecord {
  id: string;
  userId: string;
  expoPushToken: string;
  devicePlatform: 'ios' | 'android' | 'web';
  deviceName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  raisedBy: string;
  respondentId: string;
  reason: string;
  details: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface VerificationCase {
  id: string;
  profileId: string;
  documentType: 'aadhaar' | 'pan' | 'gstin' | 'voter_id';
  documentMaskedId: string;
  documentStoragePath?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  applicantProfile?: {
    fullName?: string;
    email?: string;
    role?: string;
    phone?: string;
    preferredLocality?: string;
    serviceAreas?: string[];
    skills?: string[];
    upiId?: string;
    businessName?: string;
  };
}

export interface AuditLog {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
  actorEmail?: string;
}

export type SafetyCategory = 'safety' | 'harassment' | 'wage_theft' | 'unsafe_conditions' | 'fraud' | 'other';
export type SafetySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'dismissed';

export interface SafetyReport {
  id: string;
  reporterId: string;
  reportedId?: string;
  jobId?: string;
  category: SafetyCategory;
  severity: SafetySeverity;
  description: string;
  evidenceUrls?: string[];
  status: SafetyStatus;
  staffNotes?: string;
  actionTaken?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  reporterName?: string;
  jobTitle?: string;
}

export interface PlatformSetting {
  key: string;
  value: any;
  description?: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface AdminOverviewMetrics {
  activeShifts: number;
  totalEscrowHeld: number;
  settledPayoutsTotal?: number;
  verifiedWorkersCount: number;
  activeOrganizersCount: number;
  platformFeesCollected: number;
  pendingVerificationsCount: number;
  openDisputesCount: number;
  criticalSafetyReportsCount: number;
  hasQueryErrors?: boolean;
}

export interface PilotMetricsSummary {
  pilotCity: string;
  category: string;
  startDate: string;
  endDate: string;
  totalGenuineJobsPosted: number;
  totalPositionsRequested: number;
  totalPositionsFilled: number;
  totalApplicationsReceived: number;
  totalWorkersSelected: number;
  totalWorkersConfirmed: number;
  totalWorkersCheckedIn: number;
  totalShiftsCompleted: number;
  totalWagesPaidINR: number;
  totalPlatformFeesCollectedINR: number;
  averageWorkerWageINR: number;
  
  // Rate metrics (0 - 100%)
  fillRatePct: number;
  applicationToSelectionRatePct: number;
  workerConfirmationRatePct: number;
  workerShowUpRatePct: number;
  onTimePaymentRatePct: number;
  organizerRepeatBookingRatePct: number;
  workerRepeatParticipationRatePct: number;
  
  // Operational Quality & Friction Rates
  cancellationRatePct: number;
  complaintRatePct: number;
  disputeRatePct: number;
  standbyReplacementsDispatched: number;
  
  // Unit Economics
  averageGrossTransactionValueINR: number;
  averageContributionMarginPerEventINR: number;
  averageNetMarginPct: number;
}

export interface EmergencyBroadcastDetails {
  broadcastReference?: string;
  alertLevel?: 'red' | 'orange' | 'yellow';
  declaredTrigger?: string;
  affectedRadius?: string;
  effectiveFrom?: string;
  wageProtectionSecured?: boolean;
  operationalScope?: string;
}

export interface SystemOperationalStatus {
  isOperational: boolean;
  isBookingPaused: boolean;
  pauseReason?: string;
  pausedBy?: string;
  pausedAt?: string;
  activeOutageMessage?: string;
  apiSuccessRatePct: number;
  p95DatabaseLatencyMs: number;
  reconciliationDiscrepancyCount: number;
  emergencyBroadcast?: EmergencyBroadcastDetails;
}

export interface ShiftMessage {
  id: string;
  jobId: string;
  senderId: string;
  recipientId?: string;
  content: string;
  isBroadcast: boolean;
  isReported: boolean;
  reportReason?: string;
  createdAt: string;
  senderName?: string;
  senderRole?: 'worker' | 'organizer' | 'admin';
}

export interface WorkerDelayReport {
  bookingId: string;
  minutes: number;
  reason?: string;
  reportedAt: string;
}

export interface WorkerTrustScore {
  score: number; // 0 - 100
  tier: 'Elite' | 'Established' | 'Rising' | 'New';
  attendanceReliabilityPct: number;
  completedShiftsCount: number;
  punctualityRatePct: number;
  ratingAverage: number;
  unresolvedDisputesCount: number;
  hasActiveAppeal: boolean;
  breakdown: {
    label: string;
    value: string;
    positive: boolean;
  }[];
}

export interface ShiftConflictCheck {
  hasConflict: boolean;
  hasTravelWarning: boolean;
  conflictingJob?: Job;
  message?: string;
  recommendedBufferMinutes?: number;
}


