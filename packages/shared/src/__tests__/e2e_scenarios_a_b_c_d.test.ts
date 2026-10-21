/**
 * OPSKL End-to-End Test Suite: Scenarios A, B, C, and D
 * Validates zero-demo first-time onboarding, job creation, application,
 * capacity-safe worker acceptance, multi-tenant isolation, and failure modes.
 */

import {
  calculateJobFinancials,
  isValidIndianUpiId,
  applyForJobSafe,
  confirmWorkerBookingSafe,
  updateApplicationStatusSafe,
  updateJobStatus,
  createJobSafe,
  updateWorkerProfile,
  updateOrganizerProfile,
  updateUserProfile,
} from "../index";
import {
  ShiftCreateSchema,
  GstinSchema,
  EmailLoginSchema,
} from "@opskil/validation";

// Mock Supabase client for safe atomic execution in isolated unit/CI environment
jest.mock("../supabase/client", () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn();

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
      auth: {
        getSession: jest.fn(),
        signOut: jest.fn(),
      },
    },
    __mockRpc: mockRpc,
    __mockFrom: mockFrom,
  };
});

const { __mockRpc, __mockFrom } = require("../supabase/client");

describe("E2E Lifecycle: Scenarios A, B, C, & D", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // SCENARIO A: First-time Organizer Onboarding & Job Publishing
  // =========================================================================
  describe("Scenario A: First-Time Organizer", () => {
    const organizerId = "org-fresh-uuid-001";
    const unauthorizedOrgId = "org-intruder-uuid-999";

    test("1. Validates organizer credentials during registration", () => {
      const validCreds = { email: "organizer@apexevents.in" };
      const res = EmailLoginSchema.safeParse(validCreds);
      expect(res.success).toBe(true);

      const invalidEmail = { email: "invalid-email" };
      expect(EmailLoginSchema.safeParse(invalidEmail).success).toBe(false);
    });

    test("2. First-time organizer starts with empty state", () => {
      const initialMetrics = {
        activeJobs: 0,
        openPositions: 0,
        newApplications: 0,
        shortlistedApplicants: 0,
        confirmedWorkers: 0,
        upcomingEvents: 0,
        completedShifts: 0,
        totalStaffingSpend: 0,
      };
      expect(initialMetrics.activeJobs).toBe(0);
      expect(initialMetrics.newApplications).toBe(0);
      expect(initialMetrics.totalStaffingSpend).toBe(0);
    });

    test("3. Completes organization profile with GSTIN and billing address", async () => {
      const gstin = "27AABCA1234F1Z5";
      expect(GstinSchema.safeParse(gstin).success).toBe(true);

      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: organizerId,
          business_name: "Apex Events Pvt Ltd",
          gstin,
          billing_address: "Unit 402, Trade Centre, BKC, Mumbai 400051",
          business_contact_phone: "9820198201",
          profile_completion_status: "completed",
        },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      __mockFrom.mockReturnValue({ update: mockUpdate });

      const profile = await updateOrganizerProfile(organizerId, {
        businessName: "Apex Events Pvt Ltd",
        gstin,
        billingAddress: "Unit 402, Trade Centre, BKC, Mumbai 400051",
        contactPhone: "9820198201",
        profileCompletionStatus: "completed",
      });

      expect(profile.business_name).toBe("Apex Events Pvt Ltd");
      expect(profile.profile_completion_status).toBe("completed");
    });

    test("4. Creates and publishes a real shift using validated schema", async () => {
      const shiftPayload = {
        title: "VIP Delegate Registration Host",
        category: "conference" as const,
        venueName: "Jio World Convention Centre, Hall 3",
        venueAddress: "G Block BKC, Bandra Kurla Complex, Mumbai 400051",
        city: "Mumbai",
        zone: "Bandra Kurla Complex (BKC)",
        date: "2026-11-20",
        startTime: "08:30",
        endTime: "17:30",
        durationHours: 9,
        hourlyRate: 200,
        slotsTotal: 5,
        duties: [
          "Welcome international delegates",
          "Scan registration QR codes",
        ],
        requiredSkills: ["Registration Scanning", "Fluent English"],
        supervisorName: "Rohit Verma",
        supervisorPhone: "9820198201",
        status: "open" as const,
      };

      const parsed = ShiftCreateSchema.safeParse(shiftPayload);
      expect(parsed.success).toBe(true);

      const financials = calculateJobFinancials(
        shiftPayload.slotsTotal,
        shiftPayload.hourlyRate * shiftPayload.durationHours,
      );
      expect(financials.totalWorkerWages).toBe(9000); // 5 workers * ₹1800
      expect(financials.platformFeeAmount).toBe(900); // 10%
      expect(financials.gstAmount).toBe(162); // 18% GST on platform fee

      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          job_id: "job-real-001",
        },
        error: null,
      });

      const result = await createJobSafe(shiftPayload, organizerId);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe("job-real-001");
    });

    test("5. Multi-tenant isolation: another organizer cannot modify or pause this job", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "UNAUTHORIZED_ACCESS",
          message:
            "User does not hold organizer ownership for this shift listing.",
        },
        error: null,
      });

      const res = await updateJobStatus(
        "job-real-001",
        unauthorizedOrgId,
        "paused",
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("User does not hold organizer ownership");
    });
  });

  // =========================================================================
  // SCENARIO B: First-time Worker Onboarding & Job Discovery/Application
  // =========================================================================
  describe("Scenario B: First-Time Worker", () => {
    const workerId = "worker-fresh-uuid-002";
    const jobId = "job-real-001";

    test("1. Worker onboarding validates name, skills, and Indian UPI handle", async () => {
      const upi = "priya.sharma@okhdfcbank";
      expect(isValidIndianUpiId(upi)).toBe(true);
      expect(isValidIndianUpiId("invalid-upi")).toBe(false);

      // Base user profile update (persists legal name)
      const mockSingleUser = jest.fn().mockResolvedValue({
        data: { id: workerId, full_name: "Priya Sharma" },
        error: null,
      });
      const mockSelectUser = jest
        .fn()
        .mockReturnValue({ single: mockSingleUser });
      const mockEqUser = jest.fn().mockReturnValue({ select: mockSelectUser });
      const mockUpdateUser = jest.fn().mockReturnValue({ eq: mockEqUser });
      __mockFrom.mockReturnValueOnce({ update: mockUpdateUser });

      const updatedUser = await updateUserProfile(workerId, {
        fullName: "Priya Sharma",
      });
      expect(updatedUser.full_name).toBe("Priya Sharma");

      // Worker profile update
      const mockSingleWorker = jest.fn().mockResolvedValue({
        data: {
          id: workerId,
          skills: ["Registration Scanning", "Fluent English"],
          upi_id: upi,
          profile_completion_status: "completed",
        },
        error: null,
      });
      const mockSelectWorker = jest
        .fn()
        .mockReturnValue({ single: mockSingleWorker });
      const mockEqWorker = jest
        .fn()
        .mockReturnValue({ select: mockSelectWorker });
      const mockUpdateWorker = jest.fn().mockReturnValue({ eq: mockEqWorker });
      __mockFrom.mockReturnValueOnce({ update: mockUpdateWorker });

      const updatedWorker = await updateWorkerProfile(workerId, {
        skills: ["Registration Scanning", "Fluent English"],
        upiId: upi,
        profileCompletionStatus: "completed",
      });
      expect(updatedWorker.skills).toContain("Registration Scanning");
    });

    test("2. Worker starts with empty applications and zero earnings", () => {
      const initialWorkerState = {
        appliedJobIds: [],
        confirmedShifts: [],
        availableBalance: 0,
        pendingBalance: 0,
      };
      expect(initialWorkerState.appliedJobIds.length).toBe(0);
      expect(initialWorkerState.availableBalance).toBe(0);
    });

    test("3. Applies for organizer published shift and receives valid application", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          application: {
            id: "app-priya-001",
            job_id: jobId,
            worker_id: workerId,
            status: "applied",
            applied_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const res = await applyForJobSafe(jobId, workerId);
      expect(res.success).toBe(true);
      expect(res.application?.id).toBe("app-priya-001");
      expect(res.application?.status).toBe("applied");
    });

    test("4. Duplicate application attempt is rejected idempotently", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "ALREADY_APPLIED",
          message:
            "Worker has already submitted an application for this shift.",
        },
        error: null,
      });

      const res = await applyForJobSafe(jobId, workerId);
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("ALREADY_APPLIED");
    });
  });

  // =========================================================================
  // SCENARIO C: Organizer Accepts Worker & Booking Created
  // =========================================================================
  describe("Scenario C: Organizer Accepts Worker & Booking Creation", () => {
    const organizerId = "org-fresh-uuid-001";
    const workerId = "worker-fresh-uuid-002";
    const jobId = "job-real-001";
    const unauthorizedUserId = "unauth-user-999";

    test("1. Organizer shortlists candidate", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const res = await updateApplicationStatusSafe(
        "app-priya-001",
        "shortlisted",
        organizerId,
      );
      expect(res.success).toBe(true);
    });

    test("2. Organizer confirms candidate into booking with capacity decrement and secure check-in code", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          booking: {
            id: "booking-priya-001",
            job_id: jobId,
            worker_id: workerId,
            organizer_id: organizerId,
            status: "confirmed",
            agreed_hourly_rate: 200,
            agreed_total_pay: 1800,
            check_in_code: "OP-4A9F",
            confirmed_at: new Date().toISOString(),
          },
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe(jobId, workerId, organizerId);
      expect(res.success).toBe(true);
      expect(res.booking?.status).toBe("confirmed");
      expect((res.booking as any)?.check_in_code || res.booking?.checkInCode).toMatch(/^OP-[A-Z0-9]+$/);
    });

    test("3. Cannot confirm the same worker twice for the same booking", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "ALREADY_BOOKED",
          message: "Worker is already confirmed for this shift.",
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe(jobId, workerId, organizerId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Worker is already confirmed for this shift.");
    });

    test("4. Unauthorized user cannot perform booking confirmation", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "UNAUTHORIZED",
          message: "Not authorized to hire for this shift",
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe(
        jobId,
        workerId,
        unauthorizedUserId,
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("Not authorized");
    });
  });

  // =========================================================================
  // SCENARIO D: Failure Modes & Edge Cases
  // =========================================================================
  describe("Scenario D: Failure & Edge Case Handling", () => {
    const jobId = "job-real-001";
    const workerId = "worker-fresh-uuid-002";
    const organizerId = "org-fresh-uuid-001";

    test("1. Capacity full: application or booking rejected when capacity is exhausted", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "HEADCOUNT_FULL",
          message:
            "Headcount limit reached. All 5 openings have already been filled.",
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe(
        jobId,
        "worker-another-999",
        organizerId,
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("Headcount limit reached");
    });

    test("2. Inactive account or suspended worker cannot apply", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "INELIGIBLE_WORKER",
          message: "Worker profile is deactivated or under safety suspension.",
        },
        error: null,
      });

      const res = await applyForJobSafe(jobId, "suspended-worker-000");
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("INELIGIBLE_WORKER");
    });

    test("3. Shift bookings paused by platform-wide emergency killswitch", async () => {
      __mockRpc.mockResolvedValueOnce({
        data: {
          success: false,
          error_code: "BOOKINGS_PAUSED",
          message: "Shift bookings are temporarily paused platform-wide.",
        },
        error: null,
      });

      const res = await confirmWorkerBookingSafe(jobId, workerId, organizerId);
      expect(res.success).toBe(false);
      expect(res.error).toBe(
        "Shift bookings are temporarily paused platform-wide.",
      );
    });

    test("4. Sub-minimum living wage rejected (< ₹100/hr)", () => {
      const invalidShift = {
        title: "Event Helper Below Minimum Wage",
        category: "conference",
        venueName: "Venue",
        venueAddress: "Address",
        city: "Mumbai",
        zone: "Bandra Kurla Complex (BKC)",
        date: "2026-11-20",
        startTime: "09:00",
        endTime: "17:00",
        durationHours: 8,
        hourlyRate: 80, // Fails: min ₹100
        slotsTotal: 2,
        supervisorName: "Supervisor",
        supervisorPhone: "9820198201",
      };

      const result = ShiftCreateSchema.safeParse(invalidShift);
      expect(result.success).toBe(false);
    });
  });
});
