import { Queue, Worker } from "bullmq";
import { logger } from "@stax/logger";
import { Pool } from "pg";
import { exec } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const QUEUE_NAME = "social-scheduler";

const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const schedulerQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
});

async function setupScheduledJobs() {
  try {
    // Clear existing repeatable jobs first to avoid duplicate configurations on restarts
    const jobs = await schedulerQueue.getRepeatableJobs();
    for (const job of jobs) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }

    const timezone = process.env.PUBLISH_TIMEZONE || "America/Chicago";

    // Multi-window cadence: 5am, 11am, 5pm, 11pm CT (default)
    // Override with PUBLISH_CRON_PATTERN (single window) for simpler setups.
    const singlePattern = process.env.PUBLISH_CRON_PATTERN;

    const publishWindows: Array<{ name: string; cron: string }> = singlePattern
      ? [{ name: "micro-edition-publish", cron: singlePattern }]
      : [
          { name: "micro-edition-publish-0500", cron: "0 5 * * *" },
          { name: "micro-edition-publish-1100", cron: "0 11 * * *" },
          { name: "micro-edition-publish-1700", cron: "0 17 * * *" },
          { name: "micro-edition-publish-2300", cron: "0 23 * * *" },
        ];

    for (const window of publishWindows) {
      logger.info(
        `[Scheduler] Registering repeatable job '${window.name}' with cron '${window.cron}' in timezone '${timezone}'`
      );
      await schedulerQueue.add(
        window.name,
        {},
        {
          repeat: {
            pattern: window.cron,
            tz: timezone,
          },
        }
      );
    }

    logger.info(
      `[Scheduler] ${publishWindows.length} publish window(s) registered in ${timezone}`
    );
  } catch (err) {
    logger.error("[Scheduler] Failed to setup scheduled jobs:", err);
  }
}

export async function startSchedulerDaemon() {
  logger.info("[Scheduler] Starting scheduler daemon...");
  
  await setupScheduledJobs();

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`[Scheduler] Processing job: ${job.name} (id: ${job.id})`);
      
      // Match any of the 4 publish windows (or the legacy single-window name)
      const isMicroEditionJob = job.name === "micro-edition-publish" ||
        job.name.startsWith("micro-edition-publish-");

      if (isMicroEditionJob) {
        // Create run record, tagging which publish window fired
        let runId: number | undefined;
        try {
          const res = await dbPool.query<{ id: number }>(
            `INSERT INTO social_publishing_runs (job_name, run_status, trigger_source, run_mode, started_at)
             VALUES ($1, 'running', 'scheduler', 'live', NOW())
             RETURNING id`,
            [job.name]
          );
          runId = res.rows[0].id;
          logger.info(`[Scheduler] Created run record with ID ${runId} for window '${job.name}'`);
        } catch (dbErr) {
          logger.error("[Scheduler] Failed to create run record in DB:", dbErr);
        }

        const scriptPath = path.resolve(
          process.env.WORKSPACE_ROOT || "c:/Users/aewoo/.projects/repos/ss-sailsouthern-com",
          "scripts/generate-micro-edition.ts"
        );
        const cmd = `npx tsx "${scriptPath}" ${runId ? `--run-id ${runId}` : ""}`;
        
        logger.info(`[Scheduler] Spawning child process: ${cmd}`);

        await new Promise<void>((resolve, reject) => {
          exec(cmd, async (error, stdout, stderr) => {
            if (stdout) logger.info(`[Scheduler stdout]\n${stdout}`);
            if (stderr) logger.error(`[Scheduler stderr]\n${stderr}`);
            if (error) {
              logger.error(`[Scheduler] Exec error for job ${job.id}:`, error);
              if (runId) {
                try {
                  await dbPool.query(
                    `UPDATE social_publishing_runs 
                     SET run_status = 'failed',
                         completed_at = NOW(),
                         error_message = $1
                     WHERE id = $2 AND run_status = 'running'`,
                    [error.message, runId]
                  );
                } catch (dbErr) {
                  logger.error("[Scheduler] Fallback database update failed:", dbErr);
                }
              }
              reject(error);
            } else {
              logger.info(`[Scheduler] Finished child process execution for job ${job.id}`);
              resolve();
            }
          });
        });
      }

    },
    {
      connection: redisConnection,
    }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[Scheduler] Job ${job?.id} failed:`, err);
  });

  worker.on("completed", (job) => {
    logger.info(`[Scheduler] Job ${job?.id} completed.`);
  });
}
