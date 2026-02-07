import sgMail from "@sendgrid/mail";

interface SendEmailResult {
  success: boolean;
  error?: string;
  id?: string;
}

function initSendGrid() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;
  sgMail.setApiKey(apiKey);
  return true;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  const configured = initSendGrid();

  if (!configured) {
    console.log("[EMAIL] No SENDGRID_API_KEY configured - simulating email send");
    console.log(`[EMAIL] Would send to ${to}: ${subject}`);
    return { success: true, id: "dev-mock" };
  }

  try {
    const [result] = await sgMail.send({
      to,
      from: process.env.EMAIL_FROM || "FirstUser <noreply@firstuser.app>",
      subject,
      html,
    });

    const messageId = result.headers["x-message-id"] || result.headers["X-Message-Id"];
    return { success: true, id: typeof messageId === "string" ? messageId : "sendgrid" };
  } catch (error: any) {
    console.error("[EMAIL] SendGrid error:", error?.response?.body || error?.message || error);
    return { success: false, error: error?.message || "Failed to send email" };
  }
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<SendEmailResult> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background-color: #0a0510;
            color: #ffffff;
            padding: 40px;
            margin: 0;
          }
          .container {
            max-width: 480px;
            margin: 0 auto;
            background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 40px;
          }
          .logo { text-align: center; margin-bottom: 32px; }
          .logo h1 {
            background: linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 28px;
            margin: 0;
          }
          .code-box {
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin: 24px 0;
          }
          .code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            color: #ffffff;
          }
          .text { color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.6; }
          .footer { color: rgba(255,255,255,0.4); font-size: 12px; text-align: center; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <h1>FirstUser</h1>
          </div>
          <p class="text">Here's your verification code:</p>
          <div class="code-box">
            <span class="code">${code}</span>
          </div>
          <p class="text">This code expires in 5 minutes. If you didn't request this code, you can safely ignore this email.</p>
          <div class="footer">
            <p>FirstUser - Be early. Earn your badge.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail(email, `Your FirstUser verification code: ${code}`, html);
}
