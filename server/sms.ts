// SMS sending via Twilio Replit connector (connection:conn_twilio_01KHBJWJ28W58TPT9ADA5W8FQ7)
import { sendTwilioSMS } from "./twilio";

interface SendSmsResult {
  success: boolean;
  error?: string;
  sid?: string;
  providerStatus?: number;
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (phone.trim().startsWith("+")) return phone.trim();
  return `+${digits}`;
}

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  const result = await sendSMSWithResult(phone, message);
  return result.success;
}

export async function sendSMSWithResult(phone: string, message: string): Promise<SendSmsResult> {
  try {
    const toPhone = toE164(phone);
    const result = await sendTwilioSMS(toPhone, message);
    if (!result.success) {
      console.error("[SMS] Twilio send failed:", result.error);
      return {
        success: false,
        error: result.error || "Twilio request failed",
      };
    }
    return { success: true, sid: result.sid };
  } catch (error: any) {
    console.error("[SMS] Unexpected error:", error?.message);
    return {
      success: false,
      error: error?.message || "SMS send failed",
    };
  }
}
