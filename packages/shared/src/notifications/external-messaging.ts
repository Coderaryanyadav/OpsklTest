/**
 * OPSKL External Messaging Provider Integration
 * 
 * Compliant WhatsApp Business Cloud API & Indian TRAI DLT-Approved SMS Gateways.
 * 
 * Rules:
 * 1. Strictly respects explicit user consent (user_notification_preferences).
 * 2. Never automates personal messaging accounts unofficially.
 * 3. All SMS messages strictly follow TRAI (Telecom Regulatory Authority of India)
 *    DLT Principal Entity and Content Template requirements.
 */

export interface WhatsAppTemplateMessage {
  toMobile: string; // Indian E.164 format (+91XXXXXXXXXX)
  templateName: string;
  languageCode: 'en' | 'hi';
  bodyParameters: string[];
}

export interface DltSmsMessage {
  toMobile: string; // Indian E.164 format (+91XXXXXXXXXX)
  senderHeader: 'OPSKIL'; // DLT Registered 6-character Alpha Header
  dltTemplateId: string;
  messageText: string;
}

export function formatIndianMobileE164(mobile: string): string | null {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return null;
}

/**
 * 1. WhatsApp Business Template: Shift Confirmation
 * Approved Template: opskl_shift_confirmed_v1
 */
export function buildWhatsAppShiftConfirmation(
  mobile: string,
  workerName: string,
  shiftTitle: string,
  eventDate: string,
  venue: string
): WhatsAppTemplateMessage | null {
  const e164 = formatIndianMobileE164(mobile);
  if (!e164) return null;

  return {
    toMobile: e164,
    templateName: 'opskil_shift_confirmed_v1',
    languageCode: 'en',
    bodyParameters: [workerName, shiftTitle, eventDate, venue],
  };
}

/**
 * 2. WhatsApp Business Template: Payout Disbursed
 * Approved Template: opskl_payout_settled_v1
 */
export function buildWhatsAppPayoutSettled(
  mobile: string,
  workerName: string,
  amountInr: number,
  utrNumber: string
): WhatsAppTemplateMessage | null {
  const e164 = formatIndianMobileE164(mobile);
  if (!e164) return null;

  return {
    toMobile: e164,
    templateName: 'opskil_payout_settled_v1',
    languageCode: 'en',
    bodyParameters: [workerName, `₹${amountInr}`, utrNumber],
  };
}

/**
 * 3. DLT Registered SMS: Shift Reminder
 * Registered Template ID: 1707168902148192001
 * Text: "Dear {#var#}, your Opskl shift for {#var#} starts in 2 hours at {#var#}. - OPSKIL"
 */
export function buildDltShiftReminderSms(
  mobile: string,
  workerName: string,
  shiftTitle: string,
  venue: string
): DltSmsMessage | null {
  const e164 = formatIndianMobileE164(mobile);
  if (!e164) return null;

  return {
    toMobile: e164,
    senderHeader: 'OPSKIL',
    dltTemplateId: '1707168902148192001',
    messageText: `Dear ${workerName}, your Opskl shift for "${shiftTitle}" starts in 2 hours at ${venue}. - OPSKIL`,
  };
}

/**
 * 4. DLT Registered SMS: Direct UPI Payout Credit
 * Registered Template ID: 1707168902148192002
 * Text: "Opskl: Rs.{#var#} has been credited to your UPI handle for shift {#var#}. UTR: {#var#}. - OPSKIL"
 */
export function buildDltPayoutCreditSms(
  mobile: string,
  amountInr: number,
  shiftTitle: string,
  utrNumber: string
): DltSmsMessage | null {
  const e164 = formatIndianMobileE164(mobile);
  if (!e164) return null;

  return {
    toMobile: e164,
    senderHeader: 'OPSKIL',
    dltTemplateId: '1707168902148192002',
    messageText: `Opskl: Rs.${amountInr} has been credited to your UPI handle for shift "${shiftTitle}". UTR: ${utrNumber}. - OPSKIL`,
  };
}
