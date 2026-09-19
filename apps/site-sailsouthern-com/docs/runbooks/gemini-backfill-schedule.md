# Gemini Relevance Backfill Schedule Runbook

## Purpose
This runbook guides operators on managing the Gemini relevance backfill crawler, adjusting limits and pricing/cost configurations, and scheduling daily backfill operations.

## Prerequisites
- Server credentials and API keys configured (`GEMINI_API_KEY` in `.env`).
- Access to the Sail Southern database containing unclassified articles.

## Step-by-Step Instructions

### Step 1: Verify Scorer Configuration
Open `scripts/enrich-relevance-gemini.ts` to review the default parameters. The default model is `gemini-2.5-flash-lite` for bulk operations, with a daily safety cap of 10,000 requests.

### Step 2: Test Relevance Classifier via Dry Run
Run a dry run first to verify API keys and DB query loops without incurring token costs:
```bash
npm run enrich-relevance-gemini -- --limit 100 --dry-run
```
Inspect logs to ensure SQL queries retrieve unclassified articles.

### Step 3: Run the Relevance Enrichment
Run the script to classify a set number of articles (e.g. 500) using the default model:
```bash
npm run enrich-relevance-gemini -- --limit 500
```
To run with a different model:
```bash
npm run enrich-relevance-gemini -- --limit 500 --model gemini-2.5-flash
```

### Step 4: Configure Daily systemd Timer
Verify that `sailsouthern-gemini-backfill.timer` is enabled:
```bash
sudo systemctl enable --now sailsouthern-gemini-backfill.timer
```

## Example Commands
- Dry run:
  ```bash
  npx tsx scripts/enrich-relevance-gemini.ts --limit 10 --dry-run
  ```
- Executing relevance classification:
  ```bash
  npx tsx scripts/enrich-relevance-gemini.ts --limit 2000
  ```

## Verify It Worked
1. Check the database logs to verify cost logs were updated:
   ```sql
   SELECT * FROM gemini_usage_log ORDER BY run_date DESC LIMIT 5;
   ```
2. Verify that articles have had their relevance scores updated:
   ```sql
   SELECT id, title, relevance_score, relevance_version, relevance_checked_at
   FROM article_links
   WHERE relevance_checked_at IS NOT NULL
   ORDER BY relevance_checked_at DESC
   LIMIT 10;
   ```
3. Check the telemetry dashboard or heartbeat metrics to verify `gemini_usage_log` is populated.
