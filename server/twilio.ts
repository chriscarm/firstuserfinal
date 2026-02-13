export async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return { success: false, error: "Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)" };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: fromNumber,
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

    const result = await response.json() as { sid?: string; message?: string; status?: string; code?: number };

    if (!response.ok) {
      const errorMsg = result.message || `Twilio request failed (${response.status})`;
      console.error("[Twilio SMS] API error:", errorMsg, "Code:", result.code, "Status:", response.status);
      return { success: false, error: errorMsg };
    }

    console.log("[Twilio SMS] Sent successfully - SID:", result.sid);
    return { success: true, sid: result.sid };
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown Twilio error";
    console.error("[Twilio SMS] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
