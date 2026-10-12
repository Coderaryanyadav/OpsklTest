import { z } from 'zod';

export const WorkerOnboardingSchema = z.object({
  fullName: z.string().min(3, 'Full legal name required as per government ID'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Valid 10-digit Indian phone number required'),
  city: z.string().default('Mumbai'),
  skills: z.array(z.string()).min(1, 'Select at least 1 verified skill'),
  upiId: z
    .string()
    .regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Valid UPI ID required for instant payouts')
    .optional(),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to Opskl Code of Conduct & Worker Terms' }),
  }),
});

export const WorkerKycSchema = z.object({
  documentType: z.enum(['aadhaar', 'pan', 'voter_id']),
  documentNumber: z.string().min(8, 'Valid document identification number required'),
});

export type WorkerOnboardingInput = z.infer<typeof WorkerOnboardingSchema>;
export type WorkerKycInput = z.infer<typeof WorkerKycSchema>;
