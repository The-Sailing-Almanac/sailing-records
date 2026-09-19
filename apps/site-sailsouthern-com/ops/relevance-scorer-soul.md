# Relevance Scorer Soul and Evolving Guide

This document defines the core guidelines, prompt philosophy, topic boundaries, and learning progression rules for the Sailing Almanac / Sail Southern Gemini Relevance Scorer agent. It ensures the scoring logic remains durable, consistent, and capable of evolving as our understanding of relevance grows.

---

## 🥞 The Scorer's Purpose
The Relevance Scorer exists to catalog, filter, and surface high-quality, relevant content for the Sailing Almanac, while keeping the repository's database pristine. It separates core sailing, sailboat racing, and nautical content from general noise (e.g., commercial cruise ships, generic tourism, general sports) without discarding historical or archival records.

---

## 🏛️ Topic Boundaries & Taxonomy

The scorer evaluates articles against three distinct layers of relevance:

### 1. High Relevance (0.5 - 0.7)
* **Sailboat Racing & Regattas:** Class racing (Laser/ILCA, Optimist, J/24, J/22, Melges, Etchells, etc.), offshore yacht racing (America's Cup, Vendée Globe, Ocean Race, Fastnet), local club race results, and race committee decisions.
* **Sailing & Yacht Cruising:** Passage logs, cruising narratives, sailboat navigation, seamanship, anchoring, and liveaboard sailing.
* **Sailing Tech & Gear:** Sails, rigging, deck hardware, electronics for sailing vessels, marine weather apps, and marine safety gear (EPIRBs, lifejackets).
* **Nautical & Marine Heritage:** Maritime history, wooden boatbuilding, classic yacht restoration, and sailing culture.
* **Wind/Kite/Foiling Sports:** Windsurfing, kiteboarding, wing foiling, and developmental foiling classes.

### 2. Medium/Weak Relevance (0.2 - 0.4)
* **General Boating:** Powerboating, general outboard engine maintenance, general boating safety, and general marine industry news.
* **Coastal Interest:** Local coastal weather patterns, oceanography, marine biology, coastal environment/conservation, and general marina developments.
* **Maritime Industry:** General commercial shipping, shipyards, tugboats, and general maritime commerce.

### 3. Low/No Relevance (0.0 - 0.1)
* **General Sports:** Football, basketball, golf, tennis, etc.
* **Commercial Tourism & Cruises:** Large commercial cruise lines (Carnival, Royal Caribbean, Princess, etc.), vacation packages, and generic travel guides.
* **General News & Spam:** Politics, global finance, general tech, local crime, pop culture, and spam endpoints.

---

## 🔄 Evolving & Versioning Rules
As the scoring model gains accuracy, we must follow these guidelines to update and refine existing database records:

1. **Version Tracking:** Every rescoring run must populate the `relevance_version` field in the `article_links` table. The current baseline version is **1**.
2. **Execution Timestamps:** Updates must record `relevance_checked_at = NOW()` to track when an article was last analyzed.
3. **Preserving Archival Data:** We **never** delete records from the database based on low relevance scores alone. Even dead links or highly suppressed entries are preserved as historical archives.
4. **Rescoring Trigger Logic:** If rules are updated (e.g., moving to version 2), the worker script should select records where `relevance_version < current_version OR relevance_version IS NULL` to perform incremental re-scoring.
