interface EnvValidationResult {
  errors: string[];
  warnings: string[];
}

function isLikelyStrongSecret(value: string): boolean {
  if (!value) return false;
  if (value.length < 32) return false;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  return hasLetter && hasNumber;
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateRuntimeEnvironment(env: NodeJS.ProcessEnv): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is required.");
  } else if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push("DATABASE_URL must be a postgres connection string.");
  }

  if (!env.SESSION_SECRET) {
    errors.push("SESSION_SECRET is required.");
  } else if (!isLikelyStrongSecret(env.SESSION_SECRET)) {
    errors.push("SESSION_SECRET must be at least 32 chars and include letters + numbers.");
  }

  if (isProduction) {
    if (!env.PUBLIC_APP_URL) {
      errors.push("PUBLIC_APP_URL is required in production.");
    } else if (!isHttpsUrl(env.PUBLIC_APP_URL)) {
      errors.push("PUBLIC_APP_URL must be an https URL in production.");
    }

    if (!env.OPS_ALERT_WEBHOOK_URL) {
      warnings.push("OPS_ALERT_WEBHOOK_URL is not set. Critical alerts will only appear in logs.");
    } else if (!isHttpsUrl(env.OPS_ALERT_WEBHOOK_URL)) {
      errors.push("OPS_ALERT_WEBHOOK_URL must be an https URL in production.");
    }

    if (!env.INTEGRATION_WIDGET_SIGNING_SECRET) {
      warnings.push("INTEGRATION_WIDGET_SIGNING_SECRET not set. Falling back to SESSION_SECRET.");
    }
  }

  if (!env.EMAIL_FROM) {
    warnings.push("EMAIL_FROM not set. Email sender will use fallback.");
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    warnings.push("Twilio env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not fully set. SMS delivery will fail.");
  }
  if (!env.SENDGRID_API_KEY) {
    warnings.push("SENDGRID_API_KEY not set. Email delivery will fail.");
  }

  return { errors, warnings };
}
