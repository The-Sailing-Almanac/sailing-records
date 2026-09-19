/**
 * scripts/generate-handicap-report.ts
 *
 * Compiles aggregate statistics for PHRF, ORC, and IRC handicap systems,
 * computes ratings distributions, and generates structured reports.
 * Usage:
 *   npx tsx scripts/generate-handicap-report.ts
 */

import { pool, closePool } from "./lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const dryRun = process.argv.includes("--dry-run");

async function compileReport(systemSlug: string) {
  console.log(`[Handicap Report] Compiling stats for: ${systemSlug}...`);

  let count = 0;
  let avg = 0;
  let min = 0;
  let max = 0;
  let distribution: Record<string, number> = {};

  if (systemSlug === "phrf") {
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(AVG(rating_base), 0)::double precision as avg,
        COALESCE(MIN(rating_base), 0)::double precision as min,
        COALESCE(MAX(rating_base), 0)::double precision as max
      FROM phrf_ratings
    `);
    
    count = statsRes.rows[0].count;
    avg = statsRes.rows[0].avg;
    min = statsRes.rows[0].min;
    max = statsRes.rows[0].max;

    // Distribution
    const distRes = await pool.query<{ bin: string; count: number }>(`
      SELECT 
        CASE 
          WHEN rating_base < 0 THEN '<0'
          WHEN rating_base BETWEEN 0 AND 59 THEN '0-59'
          WHEN rating_base BETWEEN 60 AND 119 THEN '60-119'
          WHEN rating_base BETWEEN 120 AND 179 THEN '120-179'
          ELSE '>=180'
        END as bin,
        COUNT(*)::int as count
      FROM phrf_ratings
      WHERE rating_base IS NOT NULL
      GROUP BY bin
    `);
    distRes.rows.forEach(r => {
      distribution[r.bin] = r.count;
    });

  } else if (systemSlug === "orc") {
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(AVG(gph), 0)::double precision as avg,
        COALESCE(MIN(gph), 0)::double precision as min,
        COALESCE(MAX(gph), 0)::double precision as max
      FROM orc_certificates
    `);
    
    count = statsRes.rows[0].count;
    avg = statsRes.rows[0].avg;
    min = statsRes.rows[0].min;
    max = statsRes.rows[0].max;

    // Distribution
    const distRes = await pool.query<{ bin: string; count: number }>(`
      SELECT 
        CASE 
          WHEN gph < 500 THEN '<500'
          WHEN gph BETWEEN 500 AND 599 THEN '500-599'
          WHEN gph BETWEEN 600 AND 699 THEN '600-699'
          ELSE '>=700'
        END as bin,
        COUNT(*)::int as count
      FROM orc_certificates
      WHERE gph IS NOT NULL
      GROUP BY bin
    `);
    distRes.rows.forEach(r => {
      distribution[r.bin] = r.count;
    });

  } else if (systemSlug === "irc") {
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(AVG(tcc), 0)::double precision as avg,
        COALESCE(MIN(tcc), 0)::double precision as min,
        COALESCE(MAX(tcc), 0)::double precision as max
      FROM irc_certificates
    `);
    
    count = statsRes.rows[0].count;
    avg = statsRes.rows[0].avg;
    min = statsRes.rows[0].min;
    max = statsRes.rows[0].max;

    // Distribution
    const distRes = await pool.query<{ bin: string; count: number }>(`
      SELECT 
        CASE 
          WHEN tcc < 0.900 THEN '<0.900'
          WHEN tcc BETWEEN 0.900 AND 0.999 THEN '0.900-0.999'
          WHEN tcc BETWEEN 1.000 AND 1.099 THEN '1.000-1.099'
          ELSE '>=1.100'
        END as bin,
        COUNT(*)::int as count
      FROM irc_certificates
      WHERE tcc IS NOT NULL
      GROUP BY bin
    `);
    distRes.rows.forEach(r => {
      distribution[r.bin] = r.count;
    });
  }

  // Generate qualitative insights via Gemini 1.5 Flash
  let insights = `### Handicap Insights: ${systemSlug.toUpperCase()}\n\n`;
  insights += `Total fleet evaluated: **${count} boats**.\n`;
  insights += `Average rating: **${avg.toFixed(2)}** (Range: ${min.toFixed(2)} to ${max.toFixed(2)}).\n\n`;
  insights += `#### Fleet Distribution:\n`;
  Object.keys(distribution).forEach(bin => {
    insights += `- **Bin ${bin}**: ${distribution[bin]} boats\n`;
  });

  if (process.env.GEMINI_API_KEY && count > 0) {
    try {
      console.log(`[Handicap Report] Generating AI insights for ${systemSlug} with Gemini...`);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are the chief handicapper for Sailing Almanac.
        Analyze the following fleet stats for the "${systemSlug.toUpperCase()}" handicap rating system:
        - Fleet Size: ${count} boats
        - Average Rating: ${avg.toFixed(2)}
        - Min Rating: ${min.toFixed(2)}
        - Max Rating: ${max.toFixed(2)}
        - Distribution: ${JSON.stringify(distribution)}

        Write a professional 2-3 paragraph executive summary of what this distribution indicates about the types of boats (e.g. lightweight racers, heavy displacement cruisers) that are active in this fleet. Add suggestions for race organizers on handicap splitting. Keep it strictly focused and formatted in clean markdown.
      `;
      const result = await model.generateContent(prompt);
      const aiText = result.response.text();
      insights += `\n#### Executive Analysis\n\n${aiText}`;
    } catch (err) {
      console.error("[Handicap Report] Gemini error:", err);
      insights += `\n*Gemini insight generation failed. Fallback standard empirical report.*`;
    }
  } else {
    insights += `\n*Insights summary compiled automatically based on empirical data.*`;
  }

  if (dryRun) {
    console.log(`[Dry Run] Prepared report for ${systemSlug}:`);
    console.log(insights);
    return;
  }

  // Save/upsert to handicap_systems_reports
  const today = new Date().toISOString().split("T")[0];
  await pool.query(`
    INSERT INTO handicap_systems_reports 
      (report_date, system_slug, total_boats_evaluated, average_rating, min_rating, max_rating, distribution_data, insights_markdown)
    VALUES ($1::date, $2, $3, $4, $5, $6, $7::jsonb, $8)
    ON CONFLICT (report_date, system_slug) DO UPDATE
    SET 
      total_boats_evaluated = EXCLUDED.total_boats_evaluated,
      average_rating = EXCLUDED.average_rating,
      min_rating = EXCLUDED.min_rating,
      max_rating = EXCLUDED.max_rating,
      distribution_data = EXCLUDED.distribution_data,
      insights_markdown = EXCLUDED.insights_markdown
  `, [
    today,
    systemSlug,
    count,
    avg,
    min,
    max,
    JSON.stringify(distribution),
    insights
  ]);

  console.log(`[Handicap Report] Saved report for ${systemSlug} to DB successfully.`);
}

async function main() {
  try {
    await compileReport("phrf");
    await compileReport("orc");
    await compileReport("irc");
  } catch (err) {
    console.error("[Handicap Report] Fatal error compiling reports:", err);
  } finally {
    await closePool();
  }
}

main();
