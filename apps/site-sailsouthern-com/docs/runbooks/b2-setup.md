# Backblaze B2 Image Storage Setup Runbook

## Purpose
This runbook describes how to set up Backblaze B2 for hosting and serving scraped fair-use thumbnail images and uploaded submission files, which will be integrated in Sprint 10.

## Prerequisites
- Backblaze B2 account.
- CLI or access to Backblaze Web Console.

## Step-by-Step Instructions

### Step 1: Create a B2 Bucket
1. Log in to the [Backblaze Web Console](https://www.backblaze.com/).
2. Navigate to **Buckets** > **Create a Bucket**.
3. Choose a unique bucket name (e.g. `sailsouthern-assets`).
4. Set the bucket type to **Public** so that images can be served directly via URL.
5. Click **Create Bucket**.

### Step 2: Configure Bucket Folders
1. Navigate to the bucket folder interface.
2. Ensure there is a folder prefix `/images/` created for article thumbnails.
3. Ensure there is a folder prefix `/submissions/` created for user-uploaded files.

### Step 3: Generate Application Keys
1. Go to **App Keys** under the account settings.
2. Click **Add a New Application Key**.
3. Name the key (e.g. `sailsouthern-uploader`).
4. Select the created bucket from the dropdown.
5. Grant **Read and Write** permissions.
6. Click **Create New Key**.
7. Copy the `keyID` and `applicationKey`.

### Step 4: Configure Environment Variables
Add the following credentials to your `.env` file on `chantecler-01`:
```env
B2_APPLICATION_KEY_ID="your_key_id"
B2_APPLICATION_KEY="your_application_key"
B2_BUCKET_NAME="sailsouthern-assets"
B2_ENDPOINT="s3.us-east-005.backblazeb2.com" # Replace with your bucket's endpoint
```

## Example Commands
Verify the configuration from the backend workspace by inspecting the `.env` contents:
```bash
grep B2_ .env
```

## Verify It Worked
1. In Sprint 10, when uploading files or saving thumbnails, verify that B2 issues a successful upload response.
2. Confirm files are publicly reachable via B2 CDN URLs:
   `https://f005.backblazeb2.com/file/sailsouthern-assets/images/<hash>.webp`
3. Verify that the response headers return `Content-Type: image/webp` and have appropriate cache control headers.
