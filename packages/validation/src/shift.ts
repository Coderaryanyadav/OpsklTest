import { z } from 'zod';

export const ShiftCategoryEnum = z.enum([
  'exhibition',
  'conference',
  'corporate',
  'activation',
  'support',
  'hospitality',
]);

export const ShiftStatusEnum = z.enum([
  'draft',
  'open',
  'filling',
  'filled',
  'paused',
  'in_progress',
  'completed',
  'cancelled',
]);

export const ShiftCreateSchema = z.object({
  title: z
    .string()
    .min(5, 'Shift title must be at least 5 characters')
    .max(80, 'Shift title cannot exceed 80 characters'),
  category: ShiftCategoryEnum,
  venueName: z.string().min(3, 'Venue name is required'),
  venueAddress: z.string().min(10, 'Complete venue address is required'),
  landmark: z.string().optional(),
  city: z.string().default('Mumbai'),
  zone: z.string().min(2, 'Venue zone/area is required'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((val) => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      return val >= today;
    }, 'Event date cannot be in the past'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM'),
  durationHours: z
    .number()
    .min(1, 'Minimum shift duration is 1 hour')
    .max(14, 'Maximum shift duration is 14 hours'),
  hourlyRate: z
    .number()
    .min(100, 'Minimum allowable wage is ₹100/hr')
    .max(2000, 'Hourly rate exceeds allowable limit'),
  slotsTotal: z
    .number()
    .int()
    .min(1, 'At least 1 worker required')
    .max(50, 'Maximum 50 workers per single shift listing'),
  dressCode: z.string().optional(),
  duties: z.array(z.string()).min(1, 'Specify at least 1 duty/responsibility'),
  perks: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  eligibilityCriteria: z.string().optional(),
  breaksMinutes: z.number().int().min(0).max(120).optional(),
  mealProvided: z.boolean().optional(),
  transportProvided: z.boolean().optional(),
  overtimePolicy: z.string().optional(),
  reportingInstructions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  applicationDeadline: z.string().optional(),
  paymentDeadline: z.string().optional(),
  supervisorName: z.string().min(2, 'Supervisor name required for on-site contact'),
  supervisorPhone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian phone number required'),
  status: ShiftStatusEnum.default('open'),
});

export type ShiftCreateInput = z.infer<typeof ShiftCreateSchema>;
