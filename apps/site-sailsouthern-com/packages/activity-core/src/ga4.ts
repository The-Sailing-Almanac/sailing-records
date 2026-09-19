export async function sendGA4Event(
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    // If credentials are not configured, log a warning but don't fail
    console.warn(`[GA4] Missing GA4_MEASUREMENT_ID or GA4_API_SECRET. Skipping event: ${eventName}`);
    return;
  }

  // Clean params to ensure only string, number, or boolean values are passed
  const cleanParams: Record<string, string | number | boolean> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        cleanParams[key] = value;
      } else {
        cleanParams[key] = String(value);
      }
    }
  }

  const clientId = process.env.GA4_CLIENT_ID || "sailsouthern_backend_node";
  const payload = {
    client_id: clientId,
    events: [
      {
        name: eventName,
        params: cleanParams,
      },
    ],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[GA4 Error] Failed to send event ${eventName}. Status: ${res.status}. Body: ${text}`);
    } else {
      console.log(`[GA4 Success] Event sent: ${eventName}`);
    }
  } catch (err) {
    console.error(`[GA4 Error] Exception occurred while sending event ${eventName}:`, err);
  }
}
