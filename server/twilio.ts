// Twilio integration via Replit connector (connection:conn_twilio_01KHBJWJ28W58TPT9ADA5W8FQ7)

let cachedCredentials: {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
} | null = null;

async function getCredentials() {
  if (cachedCredentials) return cachedCredentials;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname) {
    throw new Error('Twilio connector not available: REPLIT_CONNECTORS_HOSTNAME is not set');
  }

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings) {
    throw new Error('Twilio not connected');
  }

  const s = connectionSettings.settings;
  console.log("[Twilio] Connector fields:", Object.keys(s));
  console.log("[Twilio] account_sid prefix:", s.account_sid?.substring(0, 4));
  console.log("[Twilio] api_key prefix:", s.api_key?.substring(0, 4));

  if (!s.account_sid || !s.api_key || !s.api_key_secret) {
    throw new Error('Twilio credentials incomplete');
  }

  cachedCredentials = {
    accountSid: s.account_sid,
    apiKey: s.api_key,
    apiKeySecret: s.api_key_secret,
    phoneNumber: s.phone_number
  };

  return cachedCredentials;
}

export async function sendTwilioSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const creds = await getCredentials();

    if (!creds.phoneNumber) {
      return { success: false, error: "No Twilio phone number configured" };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to,
      From: creds.phoneNumber,
      Body: message,
    });

    const authHeader = Buffer.from(`${creds.apiKey}:${creds.apiKeySecret}`).toString("base64");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = await response.json() as { sid?: string; message?: string; status?: string };

    if (!response.ok) {
      const errorMsg = result.message || `Twilio request failed (${response.status})`;
      console.error("[Twilio SMS] API error:", errorMsg, "Status:", response.status);
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
