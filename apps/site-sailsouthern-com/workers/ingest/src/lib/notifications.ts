import { logger } from "@stax/logger";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const TELEGRAM_TOKEN  = process.env.TELEGRAM_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const DISCORD_WEBHOOK  = process.env.DISCORD_WEBHOOK || "";
const SLACK_WEBHOOK    = process.env.SLACK_WEBHOOK || process.env.SLACK_WEBHOOK_ALERTS || process.env.SLACK_WEBHOOK_HQ || "";
const NTFY_URL         = process.env.NTFY_URL || "https://ntfy.sh";
const NTFY_TOPIC       = process.env.NTFY_TOPIC || "";
const TWILIO_SID       = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN     = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM      = process.env.TWILIO_FROM || "";
const TWILIO_TO        = process.env.TWILIO_TO || "";
const ALERT_EMAIL      = process.env.ALERT_EMAIL || "";
const RESEND_API_KEY   = process.env.RESEND_API_KEY || "";

export type AlertSeverity = "info" | "warn" | "block";

export interface AlertMessage {
  text: string;
  title?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  color?: string;
  severity?: AlertSeverity;
}

function severityColor(severity?: AlertSeverity): string {
  if (severity === "block") return "E74C3C";
  if (severity === "warn")  return "F39C12";
  return "2ECC71";
}

function sendTelegramAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const tgText = msg.title ? `*${msg.title}*\n${msg.text}` : msg.text;
  promises.push(
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: tgText, parse_mode: "Markdown" }),
    })
      .then(async (res) => { if (!res.ok) logger.warn(`[Notification] Telegram failed: ${res.status}`); })
      .catch((err) => logger.error("[Notification] Telegram error:", err))
  );
}

function sendDiscordAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!DISCORD_WEBHOOK) return;
  const colorInt = msg.color ? parseInt(msg.color, 16) : 3066993;
  const embed: Record<string, any> = { title: msg.title || "Sail Southern Alert", description: msg.text, color: colorInt };
  if (msg.fields?.length) embed.fields = msg.fields.slice(0, 25);
  promises.push(
    fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    })
      .then(async (res) => { if (!res.ok) logger.warn(`[Notification] Discord failed: ${res.status}`); })
      .catch((err) => logger.error("[Notification] Discord error:", err))
  );
}

function sendSlackAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!SLACK_WEBHOOK) return;
  const attachment = {
    title: msg.title || "Sail Southern Alert",
    text: msg.text,
    color: msg.color ? `#${msg.color}` : "#2ECC71",
    fields: msg.fields?.map(f => ({ title: f.name, value: f.value, short: f.inline ?? true })),
  };
  promises.push(
    fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.title ? `*${msg.title}*` : msg.text, attachments: [attachment] }),
    })
      .then(async (res) => { if (!res.ok) logger.warn(`[Notification] Slack failed: ${res.status}`); })
      .catch((err) => logger.error("[Notification] Slack error:", err))
  );
}

function sendNtfyAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!NTFY_TOPIC) return;
  const priority = msg.severity === "block" ? "urgent" : msg.severity === "warn" ? "high" : "default";
  const tags     = msg.severity === "block" ? "rotating_light" : msg.severity === "warn" ? "warning" : "white_check_mark";
  promises.push(
    fetch(`${NTFY_URL}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "Title": msg.title || "Sail Southern", "Priority": priority, "Tags": tags },
      body: msg.text,
    })
      .then(async (res) => { if (!res.ok) logger.warn(`[Notification] ntfy failed: ${res.status}`); })
      .catch((err) => logger.error("[Notification] ntfy error:", err))
  );
}

function sendEmailAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) return;
  const resend = new Resend(RESEND_API_KEY);
  const subject = `[${(msg.severity || "info").toUpperCase()}] ${msg.title || "Sail Southern Alert"}`;
  promises.push(
    resend.emails.send({
      from: "Sailing Almanac Alerts <hello@sailsouthern.com>",
      to: ALERT_EMAIL,
      subject,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${msg.text}</pre>`,
    })
      .then(({ error }) => { if (error) logger.warn(`[Notification] Email alert failed: ${error.message}`); })
      .catch((err) => logger.error("[Notification] Email alert error:", err))
  );
}

// SMS fires only on warn/block — info events do not warrant a text message.
function sendSmsAlert(msg: AlertMessage, promises: Array<Promise<any>>) {
  if (!msg.severity || msg.severity === "info") return;
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !TWILIO_TO) return;
  const body = (msg.title ? `[${msg.title}] ${msg.text}` : msg.text).slice(0, 160);
  promises.push(
    fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: TWILIO_FROM, To: TWILIO_TO, Body: body }).toString(),
    })
      .then(async (res) => { if (!res.ok) logger.warn(`[Notification] SMS failed: ${res.status}`); })
      .catch((err) => logger.error("[Notification] SMS error:", err))
  );
}

export async function broadcastAlert(msg: AlertMessage) {
  const enriched = { ...msg, color: msg.color ?? severityColor(msg.severity) };
  const promises: Array<Promise<any>> = [];

  sendTelegramAlert(enriched, promises);
  sendDiscordAlert(enriched, promises);
  sendSlackAlert(enriched, promises);
  sendNtfyAlert(enriched, promises);
  sendEmailAlert(enriched, promises);
  sendSmsAlert(enriched, promises);

  if (promises.length > 0) {
    await Promise.all(promises);
  } else {
    logger.info(`[Notification (Offline)]: ${enriched.title ? `[${enriched.title}] ` : ""}${enriched.text}`);
  }
}
