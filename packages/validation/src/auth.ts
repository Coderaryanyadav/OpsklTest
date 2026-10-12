import { z } from 'zod';

export const PhoneLoginSchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
});

export const OtpVerifySchema = z.object({
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'),
  otp: z
    .string()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain numbers only'),
});

export const AdminLoginSchema = z.object({
  email: z.string().email('Please enter a valid administrative email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type PhoneLoginInput = z.infer<typeof PhoneLoginSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;
