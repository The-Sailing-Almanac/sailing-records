# Sailing Almanac — Social Branding & Profile Guidelines

This document outlines the standard configuration for our federated social presence (Mastodon) and social channels (Tumblr stub, etc.).

---

## 1. Mastodon Brand Accounts

We maintain two key brand profiles under `social.sailingalmanac.org`:

### A. Sailing Almanac (`@almanac`)
* **Display Name:** Sailing Almanac
* **Avatar:** Use the generated logo (`sailing_almanac_logo.png`) featuring the stylized white paper boat on a dark navy glassmorphic badge.
* **Header Background:** A clean, wide-angle regatta start or sailing blueprint pattern.
* **Bio Template:**
  > 🗞️ The parent portal for regatta results, sailboat specifications, and handicap explorer. Curating daily news and specs for the global yachting fleet.
  > 
  > 🌐 Web: https://sailsouthern.com
  > 📬 Daily Gazette: https://sailsouthern.com/daily
* **Pinned Post:**
  > Welcome to the Sailing Almanac federated front door! Follow this profile to receive our daily newsletter dispatches directly in your Mastodon feed.
  >
  > Outbox delivery uses cryptographically signed ActivityPub requests. Discussions are curated and moderated to maintain a high-signal environment. ⛵
  >
  > #sailing #yachting #regatta

### B. Sail Southern (`@sailsouthern`)
* **Display Name:** Sail Southern
* **Avatar:** Stylized "SS" logo badge using HSL tailored ocean blue gradients.
* **Bio Template:**
  > 🌊 Regional dispatches, local race results, and event coverage for Southern sailing clubs and coastal sailors. Powered by the Sailing Almanac.
  > 
  > 🌐 Web: https://sailsouthern.com
* **Pinned Post:**
  > Local race reporting, regional weather summaries, and cruiser dispatches for the Southern sailing community.
  >
  > Discussions on make/model pages are opt-in and curated. Tag us to share your club results! 🌊

---

## 2. Tumblr Custom Theme Stub

Our Tumblr theme (`infra/tumblr/custom-theme.html`) is structured to act as a responsive feed backup:
* Uses Outfit for headings and Inter for body text.
* Supports glassmorphism styling with dark theme fallback (`--bg-primary`).
* Renders links strictly using HTTPS.
* Ensure profile avatar is set to the circular Almanac white boat logo.
