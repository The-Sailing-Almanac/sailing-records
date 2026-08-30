---
title: Yacht Scoring - Initial Product Brief & Brainstorm
type: specification
status: draft
---

# ⛵ Yacht Scoring: Product Brief

This document serves as the foundational brainstorm and MVP scope for the Yacht Scoring micro-SaaS project. It compiles notes and strategy derived from initial concept explorations.

## 🎯 The Core Concept
A focused, cloud-based micro-SaaS tool designed for small-to-mid yacht clubs to manage sailboat race series. It specifically handles:
*   Entries
*   PHRF/handicap scoring
*   Results publishing
*   Series standings

**The Goal:** To replace aging desktop software (like Sailwave) and complex spreadsheets with a mobile-first, easy-to-use web app.
**Target Pricing:** $30–$80/month per club.

## 💡 The Problem & The Buyer
*   **The Buyer:** Committee Chairs and Fleet Directors. They are volunteers who want their events to run smoothly without spending their entire weekend doing data entry. 
*   **The Pitch:** You aren't selling them "software"—you are selling them their Sunday evenings back and eliminating the angry emails from sailors asking where the results are. If the Chair loves it, $30-$80/mo is an easy operational expense for the Club Manager to approve.
*   **The Pain Points:**
    *   **Entry Collection:** Chasing down boats to confirm racing, verify PHRF certificates.
    *   **Rating Management:** Keeping track of changing PHRF certificates and local fleet adjustments.
    *   **Results Turnaround:** The delay caused by volunteer scorers having to go home to manually enter times into desktop software and export PDFs.
    *   **Series Standings:** Managing the complex and fiddly rules around throwouts in a spreadsheet.

## 🚀 MVP Scope (Windward-Leeward focus, No Payments)
By specifically dropping payment processing, the project eliminates immense technical complexity (no Stripe integration, no refund handling, no PCI compliance). 

The absolute smallest version a club would pay for:
*   **Frictionless Entry:** A simple mobile-friendly form for sailors to enter their boat name, sail number, and PHRF rating. 
*   **The "Committee Boat" Interface:** A mobile/tablet-optimized view for the race committee to simply tap boats as they cross the finish line (or enter elapsed times) directly from the water.
*   **Instant Cloud Scoring:** The app instantly applies the PHRF math (Time-on-Time or Time-on-Distance). The primary focus for the MVP is windward-leeward coastal racing.
*   **Live Results & Series Standings:** A public, shareable URL where results and updated series standings (with standard throw-out logic) are instantly visible to the fleet before they even reach the dock. No more PDFs.

## 🗺️ Go-To-Market Strategy (Targeting the Gulf Coast)
The Gulf Coast sailing community (from Galveston Bay to Mobile Bay to Florida) is incredibly interconnected. Fleet sizes vary but are generally small to medium.
*   **The Wedge:** You don't need a massive marketing budget. You need to sponsor or offer the software for free to **two** highly visible regattas or local series (e.g., the Harvest Moon Regatta or a prominent Wednesday night series). 
*   **The Virality:** Sailors race at multiple clubs. If a fleet director from Club A goes to race at Club B and sees them using your tool to get results out instantly, they will demand Club A adopt it. 
*   **Direct Outreach:** Scrape the contact info for the Race Committee Chairs of every yacht club on the Gulf Coast and send a highly targeted cold email: *"I'm a local sailor building a tool to kill Sailwave and get your results out before the bar opens."*

## 🥊 Competitive Landscape & Gaps
*   **Regatta Network / Clubspot:** These are massive, bloated, and expensive. They are built around payment processing, deep club management, and massive national regattas. They are severe overkill for a 15-boat Wednesday night series.
*   **Sailwave:** The incumbent. It's powerful but it's fundamentally desktop-bound, aging, and requires manual data entry and exporting to static HTML/PDFs. 
*   **Your Gap:** The modern, mobile-first, cloud-based "easy button" that is strictly focused on scoring and instant results publishing, without the bloat of club management or payment processing.
