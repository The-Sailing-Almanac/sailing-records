import { logger } from "@stax/logger";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as cheerio from "cheerio";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
  region: process.env.B2_REGION || "us-east-005",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APPLICATION_KEY || "",
  },
});

export async function archiveArticleHTML(url: string, htmlContent: string): Promise<string> {
  // 1. Strip down the HTML using Cheerio
  const $ = cheerio.load(htmlContent);
  
  // Remove scripts, styles, and ads
  $("script").remove();
  $("style").remove();
  $("noscript").remove();
  $("iframe").remove();
  $(".ad").remove();
  $(".advertisement").remove();
  
  const cleanHtml = $.html();
  
  // 2. Generate hash for filename
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  
  const key = `archives/${year}/${month}/${hash}.html`;
  const bucketName = process.env.B2_BUCKET_NAME || "sailsouthern-archive";
  
  // 3. Upload to B2
  logger.info(`[Archiver] Uploading ${url} to B2 at ${key}`);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: cleanHtml,
      ContentType: "text/html",
    })
  );
  
  return `https://${bucketName}.${process.env.B2_REGION}.backblazeb2.com/${key}`;
}
