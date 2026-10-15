import { z } from 'zod';

/**
 * Validation schema for Organizers posting a new event shift
 */
export const ShiftCreateSchema = z.object({
  title: z
    .string()
    .min(5, 'Shift title must be at least 5 characters')
    .max(80, 'Shift title cannot exceed 80 characters'),
  category: z.enum([
    'exhibition',
    'conference',
    'corporate',
    'activation',
    'support',
    'hospitality',
  ]),
  venueName: z.string().min(3, 'Venue name is required'),
  venueAddress: z.string().min(10, 'Complete venue address is required'),
  landmark: z.string().optional(),
  city: z.string().default('Mumbai'),
  zone: z.string().min(2, 'Venue zone/area is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  durationHours: z.number().min(1, 'Minimum shift duration is 1 hour').max(14, 'Maximum shift duration is 14 hours'),
  hourlyRate: z.number().min(100, 'Minimum wage is ₹100/hr').max(2000, 'Hourly rate exceeds maximum allowable limit'),
  slotsTotal: z.number().int().min(1, 'At least 1 worker required').max(50, 'Maximum 50 workers per single shift listing'),
  dressCode: z.string().optional(),
  duties: z.array(z.string()).min(1, 'Specify at least 1 duty/responsibility'),
  perks: z.array(z.string()).optional(),
  supervisorName: z.string().min(2, 'Supervisor name required for on-site contact'),
  supervisorPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian phone number required'),
});

export type ShiftCreateInput = z.infer<typeof ShiftCreateSchema>;

/**
 * Validation schema for Worker Profile setup
 */
export const WorkerProfileSchema = z.object({
  fullName: z.string().min(3, 'Full legal name required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian phone number required'),
  email: z.string().email('Valid email address required').optional(),
  city: z.string().default('Mumbai'),
  bio: z.string().max(250).optional(),
  skills: z.array(z.string()).min(1, 'Select at least 1 skill'),
  upiId: z
    .string()
    .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Valid UPI ID required for instant payouts')
    .optional(),
  emergencyContact: z
    .object({
      name: z.string().min(2),
      phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid emergency phone number'),
      relationship: z.string().min(2),
    })
    .optional(),
});

export type WorkerProfileInput = z.infer<typeof WorkerProfileSchema>;

/**
 * Mobile Safe Environment Variable Schema
 * Enforces strict separation between safe client keys and server-only secrets.
 */
export const MobilePublicEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url('EXPO_PUBLIC_SUPABASE_URL must be a valid URL'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY is required'),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  EXPO_PUBLIC_DEFAULT_CITY: z.string().default('Mumbai'),
  EXPO_PUBLIC_DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
});

export type MobilePublicEnv = z.infer<typeof MobilePublicEnvSchema>;

/**
 * Server Environment Variable Schema (Admin / Server functions only)
 */
export const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'Server-only service role key is required'),
  DATABASE_URL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
