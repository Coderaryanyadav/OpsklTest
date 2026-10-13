import {
  PhoneLoginSchema,
  OtpVerifySchema,
  EmailLoginSchema,
  EmailOtpVerifySchema,
  AdminLoginSchema,
  ShiftCreateSchema,
  GstinSchema,
} from '../index';

describe('Opskl Validation Schemas', () => {
  test('validates email login input', () => {
    expect(EmailLoginSchema.safeParse({ email: 'worker@gmail.com' }).success).toBe(true);
    expect(EmailLoginSchema.safeParse({ email: 'organizer.event@opskil.com' }).success).toBe(true);
    expect(EmailLoginSchema.safeParse({ email: 'invalid-email' }).success).toBe(false);
  });

  test('validates 6-digit email OTP verification', () => {
    expect(EmailOtpVerifySchema.safeParse({ email: 'worker@gmail.com', otp: '123456' }).success).toBe(true);
    expect(EmailOtpVerifySchema.safeParse({ email: 'worker@gmail.com', otp: '123' }).success).toBe(false);
  });

  test('validates phone login input', () => {
    expect(PhoneLoginSchema.safeParse({ phone: '9820098200' }).success).toBe(true);
    expect(PhoneLoginSchema.safeParse({ phone: '123' }).success).toBe(false);
  });

  test('validates 6-digit OTP verification', () => {
    expect(OtpVerifySchema.safeParse({ phone: '9820098200', otp: '123456' }).success).toBe(true);
    expect(OtpVerifySchema.safeParse({ phone: '9820098200', otp: '123' }).success).toBe(false);
  });

  test('validates admin email and password', () => {
    expect(
      AdminLoginSchema.safeParse({ email: 'admin@opskil.com', password: 'secure_password_123' }).success
    ).toBe(true);
    expect(AdminLoginSchema.safeParse({ email: 'invalid-email', password: 'short' }).success).toBe(false);
  });

  test('validates Indian GSTIN format', () => {
    expect(GstinSchema.safeParse('27AABCA1234F1Z5').success).toBe(true);
    expect(GstinSchema.safeParse('INVALID_GSTIN').success).toBe(false);
  });

  test('validates complete shift payload', () => {
    const valid = {
      title: 'Registration Desk & Usher',
      category: 'exhibition',
      venueName: 'NESCO Bombay Exhibition Centre',
      venueAddress: 'Western Express Highway, Goregaon East, Mumbai 400063',
      city: 'Mumbai',
      zone: 'Goregaon East',
      date: '2026-10-20',
      startTime: '09:00',
      endTime: '17:00',
      durationHours: 8,
      hourlyRate: 175,
      slotsTotal: 10,
      duties: ['Verify tickets', 'Direct guests to main hall'],
      supervisorName: 'Rohit Verma',
      supervisorPhone: '9820198201',
    };
    expect(ShiftCreateSchema.safeParse(valid).success).toBe(true);
  });
});
