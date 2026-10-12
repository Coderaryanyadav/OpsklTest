import {
  formatINR,
  formatWageSummary,
  isValidIndianPhone,
  isValidUPI,
  formatISTDate,
} from '../formatters';
import { ShiftCreateSchema, MobilePublicEnvSchema } from '../schemas';

describe('Opskl Shared Formatters & Validators', () => {
  test('formats INR currency properly with Indian numbering', () => {
    expect(formatINR(1500)).toBe('₹1,500');
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR(0)).toBe('₹0');
  });

  test('formats wage breakdown correctly', () => {
    const summary = formatWageSummary(175, 8);
    expect(summary.totalFormatted).toBe('₹1,400');
    expect(summary.rateFormatted).toBe('₹175/hr');
  });

  test('validates 10-digit Indian mobile numbers', () => {
    expect(isValidIndianPhone('9820098200')).toBe(true);
    expect(isValidIndianPhone('+919820098200')).toBe(true);
    expect(isValidIndianPhone('1234567890')).toBe(false);
    expect(isValidIndianPhone('98200')).toBe(false);
  });

  test('validates Indian UPI addresses', () => {
    expect(isValidUPI('worker@okhdfcbank')).toBe(true);
    expect(isValidUPI('9820098200@paytm')).toBe(true);
    expect(isValidUPI('invalid_upi')).toBe(false);
  });

  test('formats IST date string', () => {
    const formatted = formatISTDate('2026-10-15T09:00:00Z');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });

  test('validates ShiftCreateSchema against valid payload', () => {
    const validShift = {
      title: 'Registration Usher - Tech Summit',
      category: 'exhibition' as const,
      venueName: 'Jio World Convention Centre',
      venueAddress: 'G Block BKC, Bandra Kurla Complex, Bandra East, Mumbai, Maharashtra 400098',
      city: 'Mumbai',
      zone: 'BKC',
      date: '2026-10-25',
      startTime: '09:00',
      endTime: '18:00',
      durationHours: 9,
      hourlyRate: 180,
      slotsTotal: 12,
      duties: ['Scan QR passes at Pavilion 2', 'Issue badge lanyards'],
      supervisorName: 'Rohit Verma',
      supervisorPhone: '9820198201',
    };

    const parsed = ShiftCreateSchema.safeParse(validShift);
    expect(parsed.success).toBe(true);
  });

  test('validates MobilePublicEnvSchema reject missing variables', () => {
    const emptyResult = MobilePublicEnvSchema.safeParse({});
    expect(emptyResult.success).toBe(false);

    const validResult = MobilePublicEnvSchema.safeParse({
      EXPO_PUBLIC_SUPABASE_URL: 'https://opskil-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_testing_purposes',
      EXPO_PUBLIC_APP_ENV: 'development',
    });
    expect(validResult.success).toBe(true);
  });
});
