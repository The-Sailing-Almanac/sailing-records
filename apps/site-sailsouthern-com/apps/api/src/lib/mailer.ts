import { logger } from "@stax/logger";
import { Resend } from "resend";
import { Pool } from "pg";

const resend = new Resend(process.env.RESEND_API_KEY);
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

const FROM_ADDRESS = "Sailing Almanac <hello@sailsouthern.com>";

// ─────────────────────────────────────────────────────────────
// 1. Broadcast the front-page newsletter to all subscribers
// ─────────────────────────────────────────────────────────────
export async function broadcastNewsletter(newsletterId: number) {
  const nlRes = await dbPool.query(
    "SELECT title, content_md FROM newsletters WHERE id = $1",
    [newsletterId]
  );
  if (nlRes.rowCount === 0) throw new Error(`Newsletter ${newsletterId} not found`);
  const { title, content_md } = nlRes.rows[0];

  // Fetch all active subscribers
  const subRes = await dbPool.query(
    "SELECT email FROM subscribers WHERE status = 'active' AND personalized = false"
  );
  const emails = subRes.rows.map((r: { email: string }) => r.email);

  // Resend supports batch sending of up to 100 per call
  const batchSize = 100;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    await resend.batch.send(
      batch.map((to: string) => ({
        from: FROM_ADDRESS,
        to,
        subject: title,
        // html will be generated from react-email template in a future sprint
        // for now, wrap the markdown in a minimal HTML shell
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap;max-width:680px;">${content_md}</pre>`,
      }))
    );
    logger.info(`[Mailer] Sent batch ${i / batchSize + 1} of ${Math.ceil(emails.length / batchSize)}`);
  }

  logger.info(`[Mailer] Broadcast complete. Sent to ${emails.length} subscribers.`);
}

// ─────────────────────────────────────────────────────────────
// 2. Send a single personalized newsletter to one subscriber
// ─────────────────────────────────────────────────────────────
export async function sendPersonalizedNewsletter(
  to: string,
  subject: string,
  markdownContent: string
) {
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: `<pre style="font-family:sans-serif;white-space:pre-wrap;max-width:680px;">${markdownContent}</pre>`,
  });
  logger.info(`[Mailer] Sent personalized newsletter to ${to}`);
}

export async function syncResendStats() {
  try {
    const listRes = await resend.emails.list({ limit: 100 });
    if (!listRes || !listRes.data) {
      logger.warn("[Mailer] No emails returned from Resend for stats sync.");
      return;
    }

    const statsByDate: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number; complained: number }> = {};

    for (const email of (listRes.data as unknown as any[])) {
      // Parse issue date from email creation timestamp
      const dateStr = new Date(email.created_at).toISOString().split("T")[0];
      if (!statsByDate[dateStr]) {
        statsByDate[dateStr] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
      }

      statsByDate[dateStr].sent++;
      
      const status = email.status;
      if (status === "delivered") statsByDate[dateStr].delivered++;
      else if (status === "opened") {
        statsByDate[dateStr].delivered++;
        statsByDate[dateStr].opened++;
      } else if (status === "clicked") {
        statsByDate[dateStr].delivered++;
        statsByDate[dateStr].opened++;
        statsByDate[dateStr].clicked++;
      } else if (status === "bounced") statsByDate[dateStr].bounced++;
      else if (status === "complained") statsByDate[dateStr].complained++;
    }

    // Upsert aggregated stats into database
    for (const [dateStr, stats] of Object.entries(statsByDate)) {
      await dbPool.query(
        `INSERT INTO resend_email_stats (issue_date, sent, delivered, opened, clicked, bounced, complained, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (issue_date) DO UPDATE
         SET sent = EXCLUDED.sent,
             delivered = EXCLUDED.delivered,
             opened = EXCLUDED.opened,
             clicked = EXCLUDED.clicked,
             bounced = EXCLUDED.bounced,
             complained = EXCLUDED.complained,
             updated_at = NOW()`,
        [dateStr, stats.sent, stats.delivered, stats.opened, stats.clicked, stats.bounced, stats.complained]
      );
    }
    logger.info("[Mailer] Resend stats sync complete.");
  } catch (err: any) {
    logger.error(`[Mailer] Resend stats sync failed: ${err.message || String(err)}`);
  }
}
