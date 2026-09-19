const USER_AGENT = "SailingAlmanac-Crawler";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  rules: Array<{ userAgent: string; disallow: string[] }>;
  fetchedAt: number;
}

export class RobotsChecker {
  private cache = new Map<string, CacheEntry>();

  private async fetchRobotsTxt(domain: string): Promise<string> {
    const res = await fetch(`https://${domain}/robots.txt`, {
      headers: { "User-Agent": `${USER_AGENT}/1.0` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`robots.txt fetch failed: ${res.status}`);
    return res.text();
  }

  private parse(txt: string): CacheEntry["rules"] {
    const rules: CacheEntry["rules"] = [];
    let currentAgents: string[] = [];
    let currentDisallow: string[] = [];

    for (const raw of txt.split("\n")) {
      const line = raw.trim();
      if (line.startsWith("User-agent:")) {
        if (currentAgents.length && currentDisallow.length) {
          rules.push({ userAgent: currentAgents.join(","), disallow: currentDisallow });
        }
        currentAgents = [line.split(":")[1].trim()];
        currentDisallow = [];
      } else if (line.startsWith("Disallow:")) {
        const path = line.split(":")[1].trim();
        if (path) currentDisallow.push(path);
      }
    }
    if (currentAgents.length) {
      rules.push({ userAgent: currentAgents.join(","), disallow: currentDisallow });
    }
    return rules;
  }

  private matches(ruleAgent: string, path: string, disallow: string[]): boolean {
    const relevant =
      ruleAgent === "*" ||
      ruleAgent.toLowerCase().includes(USER_AGENT.toLowerCase());
    if (!relevant) return false;
    return disallow.some(d => path.startsWith(d));
  }

  async isAllowed(domain: string, path: string): Promise<boolean> {
    const cached = this.cache.get(domain);
    const now = Date.now();

    let entry: CacheEntry;
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      entry = cached;
    } else {
      try {
        const txt = await this.fetchRobotsTxt(domain);
        entry = { rules: this.parse(txt), fetchedAt: now };
        this.cache.set(domain, entry);
      } catch {
        return true;
      }
    }

    return !entry.rules.some(r => this.matches(r.userAgent, path, r.disallow));
  }
}
