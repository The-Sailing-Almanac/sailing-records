import { franc } from "franc-min";

const TLD_LANG_MAP: Record<string, string> = {
  de: "de", it: "it", es: "es", fr: "fr",
  au: "en", nz: "en", uk: "en", ie: "en",
};

const FRANC_ISO3_TO_ISO1: Record<string, string> = {
  eng: "en", ita: "it", deu: "de", spa: "es", fra: "fr",
};

const SUPPORTED = new Set(["en", "it", "de", "es", "fr"]);

interface Hints {
  hreflang?: string;
  tld?: string;
}

export function detectLanguage(text: string, hints: Hints): string {
  if (hints.hreflang) {
    const lang = hints.hreflang.slice(0, 2).toLowerCase();
    if (SUPPORTED.has(lang)) return lang;
  }

  if (text.length >= 20) {
    const iso3 = franc(text, { minLength: 20 });
    const lang = FRANC_ISO3_TO_ISO1[iso3];
    if (lang && SUPPORTED.has(lang)) return lang;
  }

  if (hints.tld) {
    const lang = TLD_LANG_MAP[hints.tld.toLowerCase()];
    if (lang && SUPPORTED.has(lang)) return lang;
  }

  return "en";
}
