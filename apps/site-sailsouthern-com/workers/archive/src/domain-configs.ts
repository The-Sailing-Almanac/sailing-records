import { Pool } from "pg";

interface DomainSeed {
  domain: string;
  tier: 1 | 2 | 3;
  languages: string[];
  rate_limit_ms: number;
  sitemap_urls?: string[];
  pagination_pattern?: object;
  article_link_selector?: string;
  is_paywalled?: boolean;
}

const DOMAINS: DomainSeed[] = [
  // Tier 1
  { domain: "sailingscuttlebutt.com",  tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "sailinganarchy.com",       tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "sailingworld.com",         tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtsandyachting.com",    tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtingworld.com",        tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  { domain: "yachtingmonthly.com",      tier: 1, languages: ["en"], rate_limit_ms: 5000, is_paywalled: true },
  { domain: "sail-world.com",           tier: 1, languages: ["en"], rate_limit_ms: 5000 },
  // Tier 2
  { domain: "afloat.ie",                tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "mysailing.com.au",         tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "boatinternational.com",    tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "ussailing.org",            tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailing.org.au",           tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "yachtingnz.org.nz",        tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "cruisingworld.com",        tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailmagazine.com",         tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "seahorsemagazine.com",     tier: 2, languages: ["en"], rate_limit_ms: 3000, is_paywalled: true },
  { domain: "americascup.com",          tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "sailgp.com",              tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  { domain: "livesaildie.com",          tier: 2, languages: ["en"], rate_limit_ms: 3000 },
  // Tier 3 — international
  { domain: "yacht.de",                 tier: 3, languages: ["de"], rate_limit_ms: 3000 },
  { domain: "giornaledellavela.com",    tier: 3, languages: ["it"], rate_limit_ms: 3000 },
  { domain: "pressmare.it",             tier: 3, languages: ["it"], rate_limit_ms: 3000 },
  { domain: "boatingnz.co.nz",         tier: 3, languages: ["en"], rate_limit_ms: 3000 },
];

export async function seedDomainConfigs(pool: Pool): Promise<void> {
  for (const d of DOMAINS) {
    await pool.query(
      `INSERT INTO archive_domain_configs
         (domain, tier, languages, rate_limit_ms, sitemap_urls,
          pagination_pattern, article_link_selector, is_paywalled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (domain) DO NOTHING`,
      [
        d.domain,
        d.tier,
        d.languages,
        d.rate_limit_ms,
        d.sitemap_urls ?? null,
        d.pagination_pattern ? JSON.stringify(d.pagination_pattern) : null,
        d.article_link_selector ?? null,
        d.is_paywalled ?? false,
      ]
    );
  }
  console.log(`[ArchiveSeed] Seeded ${DOMAINS.length} domain configs.`);
}
