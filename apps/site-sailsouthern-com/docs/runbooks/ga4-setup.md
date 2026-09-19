# Google Analytics 4 (GA4) API Integration Setup Runbook

## Purpose
This runbook explains how to set up the Google Analytics 4 (GA4) Data API integration for the Sail Southern Admin Dashboard, enabling programmatic retrieval of sessions, users, pageviews, and custom click tracking events.

## Prerequisites
- Administrative access to a Google Analytics 4 property.
- Access to the Google Cloud Console.
- Access to the backend `.env` file of Sail Southern.

## Step-by-Step Instructions

### Step 1: Create a Service Account in Google Cloud
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Navigate to **IAM & Admin** > **Service Accounts**.
4. Click **Create Service Account**.
5. Provide a service account name (e.g. `ga4-analytics-viewer`), ID, and description.
6. Click **Create and Continue**.
7. (Optional) Skip assigning project roles and click **Done**.

### Step 2: Download the Service Account Credentials JSON File
1. In the list of Service Accounts, click on the newly created service account.
2. Select the **Keys** tab.
3. Click **Add Key** > **Create New Key**.
4. Choose **JSON** as the key type and click **Create**.
5. Save the downloaded JSON file securely (e.g. at `C:\Users\aewoo\.projects\repos\ss-sailsouthern-com\keys\ga4-credentials.json`).
   > [!IMPORTANT]
   > Never commit this credentials JSON file to version control. Ensure it is added to `.gitignore`.

### Step 3: Grant Viewer Access in Google Analytics 4
1. Copy the service account email address (e.g. `ga4-analytics-viewer@YOUR_PROJECT_ID.iam.gserviceaccount.com`).
2. Open [Google Analytics](https://analytics.google.com/).
3. Navigate to **Admin** > **Property Access Management** for your target property.
4. Click the **+** button > **Add users**.
5. Paste the service account email address.
6. Assign the **Viewer** role.
7. Click **Add**.

### Step 4: Configure the Environment Variables
1. Locate the GA4 Property ID. In GA4, go to **Admin** > **Property Settings** and copy the **Property ID** (a string of numbers, e.g., `123456789`).
2. Open your backend `.env` file and add the following lines:
   ```env
   GOOGLE_ANALYTICS_PROPERTY_ID="YOUR_GA4_PROPERTY_ID"
   GOOGLE_APPLICATION_CREDENTIALS="C:\Users\aewoo\.projects\repos\ss-sailsouthern-com\keys\ga4-credentials.json"
   ```

## Example Commands
Verify that the package is installed in the api workspace:
```bash
npm list @google-analytics/data --workspace=almanac-api
```

## Verify It Worked
1. Restart the backend API server:
   ```bash
   npm run start:api
   ```
2. Query the analytics endpoint using curl or a web browser:
   ```bash
   curl -H "Authorization: Bearer ${GA4_API_SECRET}" http://localhost:4000/api/admin/analytics
   ```
3. If properly configured, the response should return GA4 reports with top pages, active users, sessions, and `/sendit/` click events:
   ```json
   {
     "status": "configured",
     "topPages": [...],
     "comparison": {
       "sessions": { "current": 1050, "prior": 980, "delta": 7.14 },
       "users": { "current": 890, "prior": 810, "delta": 9.87 },
       "pageviews": { "current": 3200, "prior": 2900, "delta": 10.34 }
     },
     "topClicks": [...]
   }
   ```
4. If unconfigured or credentials are missing, the endpoint will return:
   ```json
   {
     "status": "unconfigured",
     "message": "See docs/runbooks/ga4-setup.md"
   }
   ```
