/**
 * Sail Southern GA4 Web Analytics Tracker
 * Stable client-side helper to send verified events to Google Analytics.
 */

// Helper to check if window.gtag is available
const getGtag = (): Function | null => {
  if (typeof window !== "undefined" && (window as any).gtag) {
    return (window as any).gtag;
  }
  return null;
};

export const track = {
  // Newsletter interactions
  signupStarted: (source: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "signup_started", { source, newsletter_brand: "sail_southern" });
    } else {
      console.log("[Analytics Debug] signup_started", { source });
    }
  },
  
  signupCompleted: (source: string, email_domain: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "signup_completed", { 
        source, 
        email_domain, // e.g. '@gmail.com' vs '@yachtclub.org'
        newsletter_brand: "sail_southern" 
      });
    } else {
      console.log("[Analytics Debug] signup_completed", { source, email_domain });
    }
  },

  // Issue engagement
  issueViewed: (date: string, entryPoint: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "issue_view", { 
        issue_date: date,
        entry_point: entryPoint, // 'homepage', 'social_link', 'email_click', 'direct'
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] issue_view", { issue_date: date, entry_point: entryPoint });
    }
  },

  sectionRead: (issueDate: string, section: string, scrollDepth: number) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "section_read", {
        issue_date: issueDate,
        section_name: section,
        scroll_depth: scrollDepth,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] section_read", { issue_date: issueDate, section, scrollDepth });
    }
  },

  articleClicked: (issueDate: string, articleTitle: string, sourceUrl: string) => {
    const gtag = getGtag();
    let sourceDomain = "";
    try {
      sourceDomain = new URL(sourceUrl).hostname;
    } catch {
      sourceDomain = sourceUrl;
    }
    if (gtag) {
      gtag("event", "article_click", {
        issue_date: issueDate,
        article_title: articleTitle,
        source_domain: sourceDomain,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] article_click", { issue_date: issueDate, articleTitle, sourceDomain });
    }
  },

  // Social amplification
  shareClicked: (platform: string, issueDate: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "share_intent", { 
        platform, // 'bluesky', 'mastodon', 'email', 'copy_link'
        issue_date: issueDate,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] share_intent", { platform, issueDate });
    }
  },

  // Entity interest signals
  entityClicked: (entityName: string, issueDate: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "entity_interest", {
        entity_name: entityName,
        issue_date: issueDate,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] entity_interest", { entity_name: entityName, issueDate });
    }
  },

  // Archive behavior
  archiveBrowsed: (filterType: string, filterValue: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "archive_filter", {
        filter_type: filterType,
        filter_value: filterValue,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] archive_filter", { filterType, filterValue });
    }
  },

  searchPerformed: (query: string, resultsCount: number) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "search", {
        search_term: query,
        results_count: resultsCount,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] search", { search_term: query, resultsCount });
    }
  },

  // Engagement depth
  timeOnPage: (issueDate: string, seconds: number) => {
    const gtag = getGtag();
    if (seconds > 30) {
      if (gtag) {
        gtag("event", "engaged_read", {
          issue_date: issueDate,
          duration_seconds: seconds,
          newsletter_brand: "sail_southern"
        });
      } else {
        console.log("[Analytics Debug] engaged_read", { issue_date: issueDate, duration_seconds: seconds });
      }
    }
  },

  // Conversion / Checkout Events
  supportViewed: () => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "support_page_view", { newsletter_brand: "sail_southern" });
    } else {
      console.log("[Analytics Debug] support_page_view");
    }
  },

  supportStarted: (tierName: string, price: number, billingType: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "support_started", {
        tier_name: tierName,
        value: price,
        currency: "USD",
        billing_type: billingType, // 'monthly' | 'annual' | 'one_time'
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] support_started", { tierName, price, billingType });
    }
  },

  supportCompleted: (tierName: string, price: number, billingType: string, transactionId?: string) => {
    const gtag = getGtag();
    const txId = transactionId || "tx_" + Math.random().toString(36).substring(2, 9);
    if (gtag) {
      gtag("event", "purchase", {
        transaction_id: txId,
        value: price,
        currency: "USD",
        billing_type: billingType,
        items: [{
          item_name: tierName,
          price: price,
          quantity: 1
        }],
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] purchase / supportCompleted", { txId, tierName, price, billingType });
    }
  },

  membershipTierSelected: (tierName: string, price: number) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "membership_tier_selected", {
        tier_name: tierName,
        price: price,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] membership_tier_selected", { tierName, price });
    }
  },

  customSupportOpened: () => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "custom_support_opened", { newsletter_brand: "sail_southern" });
    } else {
      console.log("[Analytics Debug] custom_support_opened");
    }
  },

  experimentAssigned: (experimentName: string, variantLabel: string) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "experiment_assigned", {
        experiment_name: experimentName,
        variant_label: variantLabel,
        newsletter_brand: "sail_southern"
      });
    } else {
      console.log("[Analytics Debug] experiment_assigned", { experimentName, variantLabel });
    }
  },

  checkoutStarted: (planName: string, price: number) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "begin_checkout", {
        value: price,
        currency: "USD",
        items: [{
          item_name: planName,
          price: price,
          quantity: 1
        }]
      });
    } else {
      console.log("[Analytics Debug] begin_checkout", { planName, price });
    }
  },
  
  conversionCompleted: (planName: string, price: number) => {
    const gtag = getGtag();
    if (gtag) {
      gtag("event", "purchase", {
        value: price,
        currency: "USD",
        transaction_id: "tx_" + Math.random().toString(36).substring(2, 9),
        items: [{
          item_name: planName,
          price: price,
          quantity: 1
        }]
      });
    } else {
      console.log("[Analytics Debug] purchase", { planName, price });
    }
  }
};
