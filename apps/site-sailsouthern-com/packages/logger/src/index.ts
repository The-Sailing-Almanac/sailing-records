function sanitizeValue(val: any): any {
  if (typeof val === "string") {
    // 1. IP addresses (IPv4 & IPv6)
    const ipv4Regex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
    const ipv6Regex = /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g;
    let s = val;
    if (ipv4Regex.test(s)) {
      s = s.replace(ipv4Regex, "[MASKED_IP]");
    }
    if (ipv6Regex.test(s)) {
      s = s.replace(ipv6Regex, "[MASKED_IP]");
    }

    // 2. Email addresses (mask to first 3 chars + ***)
    const emailRegex = /\b([A-Za-z0-9._%+-]{3})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
    if (emailRegex.test(s)) {
      s = s.replace(emailRegex, "$1***@$2");
    }

    // 3. URLs (strip query strings)
    const urlRegex = /(\bhttps?:\/\/[^\s?]+)\?[^\s]*/gi;
    s = s.replace(urlRegex, "$1");

    return s;
  }

  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }

  if (val !== null && typeof val === "object") {
    const sanitizedObj: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      const lowerK = k.toLowerCase();
      if (
        lowerK.includes("key") ||
        lowerK.includes("token") ||
        lowerK.includes("secret") ||
        lowerK.includes("auth") ||
        lowerK.includes("password")
      ) {
        const strVal = String(val[k]);
        sanitizedObj[k] = strVal.length > 6 ? strVal.slice(0, 6) + "..." : "...";
      } else if (lowerK.includes("email")) {
        const strVal = String(val[k]);
        sanitizedObj[k] = strVal.length > 3 ? strVal.slice(0, 3) + "***" : "***";
      } else if (lowerK.includes("ip") || lowerK.includes("address")) {
        sanitizedObj[k] = "[MASKED_IP]";
      } else {
        sanitizedObj[k] = sanitizeValue(val[k]);
      }
    }
    return sanitizedObj;
  }

  return val;
}

function sanitizeMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return sanitizeValue(meta) as Record<string, unknown>;
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(`[INFO] ${sanitizeValue(msg)}`, sanitizeMeta(meta) ?? ""),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(`[WARN] ${sanitizeValue(msg)}`, sanitizeMeta(meta) ?? ""),
  error: (msg: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.error(`[ERROR] ${sanitizeValue(msg)}`, {
      message: sanitizeValue(errObj.message),
      stack: errObj.stack,
      ...sanitizeMeta(meta),
    });
  },
};
