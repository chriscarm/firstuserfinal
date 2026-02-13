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

async function sendSmsViaTwilio(phone: string, message: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    return {
      success: false,
      error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
    };
  }

  try {
    const toPhone = toE164(phone);
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: toPhone,
      From: fromPhone,
      Body: message,
    });

    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json().catch(() => ({})) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!response.ok) {
      return {
        success: false,
        providerStatus: response.status,
        error: data.message || `Twilio request failed (${response.status})`,
      };
    }

    return { success: true, sid: data.sid };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Twilio request failed",
    };
  }
}

export async function sendSMS(phone: string, message: string): Promise<boolean> {
  const result = await sendSmsViaTwilio(phone, message);
  if (!result.success) {
    console.error("[SMS] Twilio send failed:", result.error, {
      providerStatus: result.providerStatus,
    });
  }
  return result.success;
}

export async function sendSMSWithResult(phone: string, message: string): Promise<SendSmsResult> {
  return sendSmsViaTwilio(phone, message);
}
