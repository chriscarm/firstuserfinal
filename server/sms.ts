export async function sendSMS(phone: string, message: string): Promise<boolean> {
  try {
    const response = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        message,
        key: process.env.TEXTBELT_API_KEY,
      }),
    });

    const result = await response.json() as { success: boolean };
    return result.success;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
}
