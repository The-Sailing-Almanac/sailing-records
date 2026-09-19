import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const b2KeyId = process.env.B2_KEY_ID;
const b2ApplicationKey = process.env.B2_APPLICATION_KEY;
const b2Endpoint = process.env.B2_ENDPOINT;
const b2BucketName = process.env.B2_BUCKET_NAME;

// Initialize S3 Client configured for Backblaze B2
export const b2Client = new S3Client({
  endpoint: b2Endpoint ? `https://${b2Endpoint}` : undefined,
  credentials: {
    accessKeyId: b2KeyId || "",
    secretAccessKey: b2ApplicationKey || "",
  },
  region: "us-east-1", // S3 SDK requires a region; B2 endpoint overrides it but region is mandatory
  forcePathStyle: true, // Backblaze B2 requires path-style routing
});

/**
 * Uploads a text/document snapshot to Backblaze B2.
 * @param key The destination path inside the bucket (e.g. `raw-html/en/2026/05/abcde.html`)
 * @param body The text or buffer content
 * @param contentType The MIME type (e.g. `text/html`, `text/markdown`)
 */
export async function uploadToB2(key: string, body: string | Buffer, contentType: string): Promise<string> {
  if (!b2BucketName) {
    throw new Error("B2_BUCKET_NAME is not configured in environment variables.");
  }

  const command = new PutObjectCommand({
    Bucket: b2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await b2Client.send(command);
  
  // Return the public-facing retrieval URL
  return `https://${b2BucketName}.${b2Endpoint}/${key}`;
}
