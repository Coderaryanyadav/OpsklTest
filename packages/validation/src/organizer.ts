import { z } from 'zod';

export const GstinSchema = z
  .string()
  .regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Please enter a valid 15-character Indian GSTIN (e.g. 27AABCA1234F1Z5)'
  );

export const OrganizerOnboardingSchema = z.object({
  companyName: z.string().min(3, 'Registered company name required'),
  gstin: GstinSchema.optional(),
  contactPerson: z.string().min(3, 'Lead contact person name required'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit mobile number required'),
  city: z.string().default('Mumbai'),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Organizer Marketplace Agreement' }),
  }),
});

export type OrganizerOnboardingInput = z.infer<typeof OrganizerOnboardingSchema>;
