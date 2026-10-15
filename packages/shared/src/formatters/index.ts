/**
 * OPSKL FORMATTERS & LOCALIZATION UTILITIES
 * Optimized for Indian business standards (INR, IST, Indian phone numbers, UPI).
 */

/**
 * Format currency in Indian Rupees (₹) using Indian numbering system (lakhs/thousands).
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0';
  }
  const rounded = Math.round(amount);
  if (rounded < 0) {
    const formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Math.abs(rounded));
    return `-₹${formatted}`;
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(rounded);
  return `₹${formatted}`;
}

/**
 * Format hourly wage breakdown for shift summary cards.
 */
export function formatWageSummary(hourlyRate: number, durationHours: number): {
  totalFormatted: string;
  rateFormatted: string;
  breakdown: string;
} {
  const total = hourlyRate * durationHours;
  return {
    totalFormatted: formatINR(total),
    rateFormatted: `${formatINR(hourlyRate)}/hr`,
    breakdown: `${formatINR(hourlyRate)} × ${durationHours} hrs = ${formatINR(total)}`,
  };
}

/**
 * Format date string into human-readable IST format (e.g. "Sat, 24 Oct 2026")
 */
export function formatISTDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Return calendar date string in Indian Standard Time (Asia/Kolkata) formatted as YYYY-MM-DD.
 * Prevents UTC timezone drift causing shifts created between 00:00 and 05:30 IST to be saved as yesterday.
 */
export function getTodayDateIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Format shift time range from 24hr HH:MM strings (e.g. "09:00" -> "9:00 AM – 6:00 PM")
 */
export function formatTimeRange(start: string, end: string): string {
  if (!start || !end) return '';

  const formatSingle = (time24: string): string => {
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  };

  return `${formatSingle(start)} – ${formatSingle(end)}`;
}

/**
 * Formats standard 10-digit Indian mobile number: "+91 98765 43210"
 */
export function formatPhoneIN(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length === 10) {
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  return phone;
}

/**
 * Validates 10-digit Indian mobile number
 */
export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return last10.length === 10 && /^[6-9]\d{9}$/.test(last10);
}

/**
 * Basic validation for Indian UPI ID (e.g. "worker@okhdfcbank" or "9876543210@paytm")
 */
export function isValidUPI(upi: string): boolean {
  if (!upi || typeof upi !== 'string') return false;
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upi.trim());
}

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

/**
 * Formats distance in km to clean human-readable text.
 */
export function formatDistance(distanceKm?: number | null): string {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) {
    return 'Distance unavailable';
  }
  if (distanceKm < 0.5) {
    return 'Under 500m away';
  }
  if (distanceKm < 1) {
    return 'Under 1 km away';
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Formats application deadline into human-readable relative or date string.
 */
export function formatDeadline(deadlineISO?: string | null): string {
  if (!deadlineISO) return 'Applications open';
  const deadline = new Date(deadlineISO);
  if (isNaN(deadline.getTime())) return 'Applications open';

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Deadline passed';
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `Closes in ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `Closes in ${diffHours}h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return 'Closes tomorrow';
  }
  return `Closes in ${diffDays} days`;
}
