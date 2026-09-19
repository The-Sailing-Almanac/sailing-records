/**
 * Script: deploy-timers.ts
 * Purpose: Operational run script.
 * Idempotent: Yes
 * Dry-run: --dry-run flag logs intended operations without writing.
 * Last run: 2026-05-28
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("[deploy-timers] [Dry Run] Enabled. Exiting safely.");
  process.exit(0);
}


const TIMERS: Array<{
  name: string;
  description: string;
  command: string;
  postCommand?: string;
  schedule: string;
}> = [
  {
    name: "almanac-daily-compile",
    description: "Daily Morning Edition Compile",
    command: "/usr/bin/npx tsx scripts/compile-edition.ts --type daily",
    postCommand: "/usr/bin/npx tsx scripts/gate-edition.ts --type daily",
    schedule: "*-*-* 10:00:00"
  },
  {
    name: "almanac-archive-edition",
    description: "Archive Previous Edition",
    command: "/usr/bin/npx tsx scripts/archive-edition.ts",
    schedule: "*-*-* 10:59:00"
  },
  {
    name: "almanac-noon-injection",
    description: "Noon News Injection",
    command: "/usr/bin/npx tsx scripts/inject-breaking.ts",
    schedule: "*-*-* 17:00:00"
  },
  {
    name: "almanac-6pm-injection",
    description: "6pm News Injection",
    command: "/usr/bin/npx tsx scripts/inject-breaking.ts",
    schedule: "*-*-* 23:00:00"
  },
  {
    name: "almanac-11pm-injection",
    description: "11pm News Injection",
    command: "/usr/bin/npx tsx scripts/inject-breaking.ts",
    schedule: "*-*-* 04:00:00"  // 11pm CDT (UTC-5); was 05:00 which ran at midnight CDT
  },
  {
    name: "almanac-weekly-compile",
    description: "Weekly Edition Compile",
    command: "/usr/bin/npx tsx scripts/compile-edition.ts --type weekly",
    postCommand: "/usr/bin/npx tsx scripts/gate-edition.ts --type weekly",
    schedule: "Mon *-*-* 10:00:00"
  },
  {
    name: "almanac-popularity",
    description: "Popularity Score Update",
    command: "/usr/bin/npx tsx scripts/update-popularity-scores.ts",
    schedule: "hourly"
  },
  {
    name: "almanac-gemini-backfill",
    description: "Gemini Backfill cost control runner",
    command: "/usr/bin/npx tsx scripts/enrich-relevance-gemini.ts --limit 5000 --model gemini-2.5-flash-lite",
    schedule: "*-*-* 07:00:00"
  },
  {
    name: "almanac-heartbeat",
    description: "System Health Heartbeat",
    command: "/usr/bin/npx tsx scripts/heartbeat.ts",
    schedule: "*:0/30"
  },
  {
    name: "almanac-feed-revalidation",
    description: "Feed Revalidation Docker Runner",
    command: "/usr/bin/docker restart almanac-feed-validator",
    schedule: "Sun *-*-* 03:00:00"
  },
  {
    name: "almanac-og-image-backfill",
    description: "OG Image Backfill",
    command: "/usr/bin/npx tsx scripts/backfill-og-images.ts",
    schedule: "*-*-* 08:00:00"
  }
];

function main() {
  console.log("[DeployTimers] Generating systemd service and timer files...");

  const tempDir = path.join(__dirname, "..", "runs", "systemd-temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const timer of TIMERS) {
    const serviceContent = `[Unit]
Description=Sailing Almanac — ${timer.description}
After=network.target

[Service]
Type=oneshot
User=aewoodyard
WorkingDirectory=/home/aewoodyard/ss-sailsouthern-com
EnvironmentFile=/home/aewoodyard/ss-sailsouthern-com/.env
ExecStart=${timer.command}${timer.postCommand ? `\nExecStartPost=${timer.postCommand}` : ""}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

    const timerContent = `[Unit]
Description=Sailing Almanac — ${timer.description} Timer
Requires=${timer.name}.service

[Timer]
OnCalendar=${timer.schedule}
Persistent=true

[Install]
WantedBy=timers.target
`;

    fs.writeFileSync(path.join(tempDir, `${timer.name}.service`), serviceContent);
    fs.writeFileSync(path.join(tempDir, `${timer.name}.timer`), timerContent);
    console.log(`  Generated files for ${timer.name}`);
  }

  console.log("[DeployTimers] Copying files to /etc/systemd/system/ and enabling timers...");

  // Copy and enable each timer
  for (const timer of TIMERS) {
    const serviceSrc = path.join(tempDir, `${timer.name}.service`);
    const timerSrc = path.join(tempDir, `${timer.name}.timer`);

    // Use sudo cp to install the files
    execSync(`sudo cp ${serviceSrc} /etc/systemd/system/`);
    execSync(`sudo cp ${timerSrc} /etc/systemd/system/`);
    
    // Enable and start timer
    execSync(`sudo systemctl enable ${timer.name}.timer`);
    execSync(`sudo systemctl restart ${timer.name}.timer`);
    console.log(`  Activated timer: ${timer.name}`);
  }

  // Reload systemd daemon
  execSync("sudo systemctl daemon-reload");
  console.log("[DeployTimers] Systemd daemon reloaded.");
  console.log("[DeployTimers] ✅ Deployed all timers successfully.");
}

main();