type OpsAlertSeverity = "critical" | "error" | "warning" | "info";

interface OpsAlertInput {
  severity: OpsAlertSeverity;
  title: string;
  message: string;
  source?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

const OPS_ALERT_WEBHOOK_URL = String(process.env.OPS_ALERT_WEBHOOK_URL || "").trim();
const OPS_ALERT_DEDUPE_MS = 5 * 60 * 1000;
const MAX_METADATA_LENGTH = 4_000;

const alertDedupes = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  alertDedupes.forEach((timestamp, key) => {
    if (now - timestamp > OPS_ALERT_DEDUPE_MS) {
      alertDedupes.delete(key);
    }
  });
}, 60_000).unref();

function shouldSendAlert(dedupeKey?: string): boolean {
  if (!dedupeKey) return true;
  const now = Date.now();
  const previous = alertDedupes.get(dedupeKey);
  if (previous && now - previous < OPS_ALERT_DEDUPE_MS) {
    return false;
  }
  alertDedupes.set(dedupeKey, now);
  return true;
}

function serializeMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) return "";
  const serialized = JSON.stringify(metadata, null, 2);
  if (!serialized) return "";
  if (serialized.length <= MAX_METADATA_LENGTH) return serialized;
  return `${serialized.slice(0, MAX_METADATA_LENGTH)}…`;
}

function buildAlertText(input: OpsAlertInput): string {
  const timestamp = new Date().toISOString();
  const source = input.source || "server";
  const metadata = serializeMetadata(input.metadata);
  const lines = [
    `FirstUser ${input.severity.toUpperCase()}: ${input.title}`,
    input.message,
    `Source: ${source}`,
    `Timestamp: ${timestamp}`,
  ];
  if (metadata) {
    lines.push(`Metadata: ${metadata}`);
  }
  return lines.join("\n");
}

export function opsAlertsConfigured(): boolean {
  return !!OPS_ALERT_WEBHOOK_URL;
}

export async function sendOpsAlert(input: OpsAlertInput): Promise<void> {
  if (!shouldSendAlert(input.dedupeKey)) return;

  const text = buildAlertText(input);

  if (!OPS_ALERT_WEBHOOK_URL) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[OpsAlert:${input.severity}] ${text}`);
    }
    return;
  }

  try {
    const payload = {
      text,
      firstuser: {
        severity: input.severity,
        title: input.title,
        message: input.message,
        source: input.source || "server",
        metadata: input.metadata || {},
        timestamp: new Date().toISOString(),
      },
    };
    const response = await fetch(OPS_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("[OpsAlert] Failed to deliver alert:", response.status, await response.text().catch(() => ""));
    }
  } catch (error) {
    console.error("[OpsAlert] Failed to deliver alert:", error);
  }
}

export function installProcessAlertHandlers() {
  process.on("unhandledRejection", (reason) => {
    void sendOpsAlert({
      severity: "critical",
      title: "Unhandled Promise Rejection",
      message: "A promise rejected without a catch handler.",
      source: "process.unhandledRejection",
      dedupeKey: "process-unhandled-rejection",
      metadata: {
        reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason),
      },
    });
  });

  process.on("uncaughtExceptionMonitor", (error) => {
    void sendOpsAlert({
      severity: "critical",
      title: "Uncaught Exception",
      message: error.message || "Unhandled exception in Node process.",
      source: "process.uncaughtExceptionMonitor",
      dedupeKey: `process-uncaught-exception-${error.name || "error"}`,
      metadata: {
        name: error.name,
        stack: error.stack,
      },
    });
  });
}
