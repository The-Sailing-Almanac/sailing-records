# Website Copy Signoff Review
# Sail Southern / Sailing Almanac — Phase 9 Audit
# Date: 2026-05-29

---

## Instructions for Operator

Read each section. Mark items as **APPROVED**, **REVISE**, or **NEEDS LEGAL REVIEW**.
Items marked REVISE include suggested replacement copy.

---

## 1. Site Identity & Branding

### Browser Title Tag (root layout)
> "Sail Southern — Sailing Club & Racing Results"

**Status:** 🔴 REVISE  
**Issue:** "Sailing Club" is not accurate — this is a news almanac, not a club.  
**Suggested:** `"Sail Southern — Sailing Almanac & Daily News"`

### Meta Description (root layout)
> "The digital deck of Sail Southern. Racing results, club logs, wind forecasts, and sailing dispatches."

**Status:** 🔴 REVISE  
**Issue:** "club logs" and "wind forecasts" not currently delivered features. Overcommits.  
**Suggested:** `"The daily sailing news almanac. Curated articles, race coverage, and coastal dispatches from across the sailing world."`

### Hero Badge (homepage)
> "Sail Southern Almanack & Record Index"

**Status:** 🟡 OPERATOR DECISION  
**Note:** Uses archaic "Almanack" spelling intentionally? If yes, fine. If not, should be "Almanac".

### Hero H1 (homepage)
> "Sailing Logs, Racing Results & Coastal Dispatches"

**Status:** ✅ APPROVED — clear, accurate, on-brand.

### Hero Subhead (homepage)
> "A high-speed, open-access archive and daily news compiler covering southern waters, regatta records, and class updates."

**Status:** 🟡 REVISE  
**Issue:** "southern waters" implies US South only — the coverage is global. "high-speed" is vague.  
**Suggested:** `"An open-access daily news compiler covering offshore racing, regattas, cruising, and class sailing from around the world."`

---

## 2. Footer

### Tagline (footer brand column)
> "A premium digital deck for racing logs, club updates, weather dispatches, and records of the southern seas."

**Status:** 🔴 REVISE  
**Issue:** Same issues as meta: "club updates" and "weather dispatches" overcommit. "premium" is a self-description, not an earned claim.  
**Suggested:** `"An open archive and daily news compiler covering racing, cruising, and the full world of sail."`

### Footer Quick Links — "Racing Leaderboards"
> Links to "/" (homepage)

**Status:** 🔴 REVISE  
**Issue:** This link goes to the homepage, not a leaderboard. Either remove it or link to the actual PHRF/handicap features.  
**Suggested:** Change to "PHRF Explorer" linking to `/handicap/phrf`, or remove.

### Footer — "Weekly Newsletter" link
> Links to `#subscribe`

**Status:** ✅ APPROVED — correct anchor behavior.

### Copyright line
> "© [year] Sail Southern. All rights reserved."

**Status:** 🟡 NEEDS LEGAL REVIEW  
**Note:** "All rights reserved" is a strong claim for a site that explicitly promotes open data. Consider: `"© [year] Sailing Almanac / Sail Southern. Content licenses vary by source."` or consult operator preference.

### Footer credit
> "Hand-coded with Next.js & CSS Variables"

**Status:** ✅ APPROVED — authentic, fine for a developer-forward project.

---

## 3. About Page

### Tagline
> "The open archive and daily record of the southern seas."

**Status:** 🟡 REVISE  
**Issue:** "southern seas" implies geographic restriction.  
**Suggested:** `"The open archive and daily news record of the sailing world."`

### Mission paragraph 1
> "Sail Southern is a continuously updated sailing news knowledgebase and almanac covering racing, cruising, and the full world of sail. A product of the Sailing Almanac project — built to be the most complete, open, and machine-readable archive of sailing knowledge ever assembled."

**Status:** 🟡 REVISE  
**Issue:** "most complete... ever assembled" is overconfident for a beta product.  
**Suggested:** `"Sail Southern is a continuously updated sailing news knowledgebase and almanac covering racing, cruising, and the full world of sail — built to be as open, complete, and machine-readable as possible."`

### Mission paragraph 2
> "Powered by open data and community contributions. Currently covering news from January 2025 forward, with historical backfill in progress."

**Status:** ✅ APPROVED — accurate and honest.

### "Nautical Integrity" card
> "We adhere strictly to our Feed Permanence doctrine. Our archives are built for archival permanence."

**Status:** 🔴 REVISE  
**Issue:** "Feed Permanence doctrine" is internal jargon that public users won't understand.  
**Suggested:** `"We preserve every article we index. Links don't rot here — we archive to the Wayback Machine to ensure the record endures."`

### "Community Powered" card
> "Support us or submit data. All contributions shape the future of our archives."

**Status:** ✅ APPROVED — clean and accurate.

---

## 4. Newsletter / Subscribe Section

### Section header (homepage)
> "The Southern Dispatch"

**Status:** 🟡 OPERATOR DECISION  
**Note:** Good editorial title. If this is the permanent name for the newsletter, approve it now so we can use it consistently everywhere.

### Section body (homepage subscribe callout)
> "Receive the daily compiled morning deck or our weekly editorial summary straight to your inbox. Completely open format, zero tracker scripts."

**Status:** 🟡 REVISE  
**Issue:** "morning deck" is jargon; "zero tracker scripts" is a claim we should only make if confirmed.  
**Suggested:** `"Get the daily sailing digest or weekly editorial summary delivered to your inbox. Plain-text friendly, no tracking pixels."`

### Subscribe form — frequency options
> Daily Edition / Weekly Edition / Monday + Thursday / All Dispatches

**Status:** 🟡 NEEDS OPERATOR DECISION  
**Issue:** "Monday + Thursday" as a biweekly option sounds arbitrary and has no backing yet. "All Dispatches" may send excessive email once we have 4 windows per day.  
**Recommended:** For beta, offer only "Daily" and "Weekly". Remove "Monday + Thursday" and "All Dispatches" until those schedules are established.

### Subscribe CTA button
> "Join Dispatch"

**Status:** ✅ APPROVED — nautical, on-brand.

### Subscribe success message
> "Welcome Aboard! — Thank you for subscribing! Please check your inbox for a confirmation email."

**Status:** ✅ APPROVED — standard, clear.

---

## 5. Support / Sponsor Page

### Support page meta description
> "Select a sponsorship plan or tip jar to support the Sailing Almanac open-data project."

**Status:** ✅ APPROVED.

### Support page intro
> "Join as an archival patron to support open sailing data. We accept one-time and recurring contributions."

**Status:** ✅ APPROVED.

### Stripe buttons (all plans)
> Buttons are currently `disabled` with CTA "Join via Stripe"

**Status:** 🟡 NEEDS OPERATOR ACTION  
**Issue:** Disabled buttons with no explanation leave users confused.  
**Suggested:** Add a small note: "Stripe integration coming soon — email alan@sailsouthern.com to support directly."

### Lightning Tip Jar
> "Stripe & Alby integrations will be fully active in Sprint 10"

**Status:** 🔴 REVISE before beta  
**Issue:** Internal sprint language is not appropriate for public pages.  
**Suggested:** `"Lightning tipping coming soon. In the meantime, contact us directly to contribute."`

### Patron tier — "Private Discord/Slack operational channel access"
**Status:** 🟡 NEEDS OPERATOR DECISION  
**Issue:** Is this Discord server actually set up? Don't promise it if not.

### Patron tier — "Nautical physical gift (branded gear / chart print)"
**Status:** 🟡 NEEDS OPERATOR DECISION  
**Issue:** Contingent on fulfillment capacity. OK to list if this is real, but mark as "future" if not ready.

---

## 6. Submit / Contribution Form

### Page title H1
> "Submit Dispatch or Spec"

**Status:** ✅ APPROVED — clear, nautical.

### Page subhead
> "Share your logs, photos, rig corrections, or community links. Contributions honor copyright policies and are eligible for Value-for-Value rewards."

**Status:** 🟡 REVISE  
**Issue:** "Value-for-Value rewards" is meaningless to most users.  
**Suggested:** `"Share your logs, photos, rig corrections, or community links. All contributions are reviewed before publication."`

### Submitter email field helper text
> "Used solely for verification and V4V Lightning reward notifications."

**Status:** 🔴 REVISE  
**Issue:** "V4V Lightning reward notifications" is jargon. Most users have no Lightning wallet.  
**Suggested:** `"Used only for follow-up communications about your submission."`

### V4V Notice callout
> "Value-for-Value Notice: Verified submissions and active federation actors are linked with LNURL/Lightning identities to accept micro-payments from the community."

**Status:** 🔴 REVISE before beta  
**Issue:** "federation actors," "LNURL" — internal/technical jargon.  
**Suggested:** Remove or replace: `"High-quality submissions may be highlighted in the daily edition and credited to contributors."`

### Submission success message
> "Thank you! Your dispatch has been enqueued for editorial approval. Verified publishings will receive V4V / Lightning micro-rewards."

**Status:** 🔴 REVISE  
**Suggested:** `"Thank you! Your submission has been received and will be reviewed by the editorial team."`

### Submit button (idle state)
> "Publish & Federate"

**Status:** 🔴 REVISE  
**Issue:** "Publish & Federate" is a backend action, not user-facing language.  
**Suggested:** `"Submit Dispatch"` or simply `"Submit"`

---

## 7. Archive / Daily Issue Labels

### `/daily` archive index  
*(Rendered from newsletter list — copy depends on what the index page shows)*  
**Status:** Needs review when index page is confirmed. No direct copy issue found in code review.

### `/daily/latest` — empty state
> "No Edition Published Yet — The first daily edition hasn't been compiled yet..."

**Status:** ✅ APPROVED — accurate, helpful, operator-friendly context included.

### Operator note in `/daily/latest` empty state
> "Run `npx tsx scripts/compile-edition.ts` to compile the first daily issue..."

**Status:** 🟡 This is operator-only text. Fine for now; should be hidden from public before beta or gated behind admin check.

---

## 8. Navigation

### "Racing Results" CTA button in nav
> Links to "/" (homepage)

**Status:** 🔴 REVISE  
**Issue:** Goes to homepage, not an actual racing results page. Either remove or route correctly.

### "Boats DB" nav link
> Links to `/boats`

**Status:** ✅ APPROVED — honest label.

### "Blog" nav link
> Links to `/blog`

**Status:** 🟡 NEEDS DECISION — does a blog page exist and is it actively maintained?

---

## Summary: Items Requiring Action Before Beta

| Priority | Location | Issue |
|----------|----------|-------|
| 🔴 HIGH | Root meta title | "Sailing Club" not accurate |
| 🔴 HIGH | Root meta description | Overcommits on unbuilt features |
| 🔴 HIGH | Footer tagline | "club updates" / "weather dispatches" not delivered |
| 🔴 HIGH | Submit form V4V callout | Technical jargon for public page |
| 🔴 HIGH | Submit button "Publish & Federate" | Not user-facing language |
| 🔴 HIGH | Submit success message | V4V/Lightning jargon |
| 🔴 HIGH | Submit email helper text | V4V/Lightning jargon |
| 🔴 HIGH | Support page sprint reference | "Sprint 10" is internal language |
| 🟡 MEDIUM | Hero subhead | "southern waters" geographic implication |
| 🟡 MEDIUM | About "Nautical Integrity" card | "Feed Permanence doctrine" is jargon |
| 🟡 MEDIUM | Subscribe body | "morning deck" jargon, tracker claim |
| 🟡 MEDIUM | Subscribe frequency options | Monday+Thursday/All Dispatches premature |
| 🟡 MEDIUM | Footer "Racing Leaderboards" | Dead link to homepage |
| 🟡 MEDIUM | Nav "Racing Results" CTA | Dead link to homepage |
| 🟡 LOW | Copyright line | "All rights reserved" vs open data ethos |
| 🟡 LOW | About mission P1 | "most complete ever" overclaims |
| 🟡 LOW | `/daily/latest` operator note | Should be gated/hidden from public |
| ⚖️ LEGAL | Copyright line wording | Operator decision needed |
| ⚖️ LEGAL | Patron Discord/Slack access | Only list if service exists |
| ⚖️ LEGAL | Patron physical gift | Only list if fulfillment is ready |
