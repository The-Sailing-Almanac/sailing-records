---
category: software
plane_id: 
profit_likelihood: high
project: None
status: archived
tags: []
title: soul
type: reference
updated_at: "2026-05-17T19:11:22Z"
---

# STAX Soul and Guardrails

This document defines the spirit, standards, and behavioral guardrails for all AI workers and human collaborators operating inside the `stax` repository. It should be used as a high-level compass so that implementation stays neat, calm, structured, and aligned with the operator’s preferences and business goals.

---

## 🥞 The Solopreneur Soul

`stax` is not just a repository. It is the operational shell for a solo software business that aims to create reliable income without creating unnecessary chaos. The system exists to reduce cognitive sprawl, reduce lost context, reduce tool thrash, and help the operator become more strategically present while being less constantly interrupted.

The spirit of the repo is:
* **Calm:** Low surprise, thoughtful execution, high-signal alerts.
* **Clean:** Strict root hygiene, organized folder trees, standardized formats.
* **Deliberate:** Bounded task execution, structured checkpoints, reviewable changes.
* **Durable:** Resumable, robust, and permanent records.
* **Respectful:** High-value digests tailored for a busy human supervisor.

---

## 🏛️ Repository Non-Negotiables

These rules are absolute, enforceable, and must be followed by every agent:

1. **Root is Sacred and Sparse:**
   * Root is the ultimate entrypoint layer. Loose files in root are strictly restricted to core system files (`stax.py`, `README.md`, `.cursorrules`, `.gitignore`).
   * **No databases in root.** (Move indexing db to `ops/stax_index.db` or relational databases to `/data`).
   * **No generated assets in root.**
   * **No scratch scripts in root.**
   * **No raw imports in root.**
2. **README is an Orientation Layer:**
   * README.md is a central portal and directory, not a dumping ground for long logs.
   * Include a short, prominent **AI Agent Gate Warning** at the top, pointing directly to the long-form rules inside `ops/soul.md` and `ops/agent-rules.md`.
3. **Preserve Raw Handoffs:**
   * Never transform or modify raw import material in-place during first-pass processing.
   * Save original files cleanly inside incoming folders (`handoffs/incoming/raw/`, `handoffs/incoming/evernote/`, etc.) before starting cleaning or extraction passes.
4. **Cleanup Discipline:**
   * Re-home orphaned files regularly.
   * Archive dead or inactive experiments inside `archive/` rather than letting them clutter live workspaces.
   * Concisely prune redundant log piles and separate noisy traces from the primary documents.
5. **Content Integrity:**
   * **Recipe content** must remain fully accurate and be structured into Google/Schema.org recipe-friendly fields for future use.
   * **Evernote imports** must be stripped of HTML junk, email header debris, and layout tags using safe cleaning scripts before classification or parsing.

---

## 🖼️ Image & Asset Storage Architecture

To prevent Git repository bloat while preserving strategic digital assets, use the following structure:

```text
stax/
└── assets/
    ├── source-images/   # Original imported images
    │   ├── evernote/
    │   ├── obsidian/
    │   └── imported/
    ├── generated/       # High-value AI outputs
    │   ├── pod/
    │   ├── brands/
    │   ├── landing-pages/
    │   └── experiments/
    ├── derived/         # Performance/size variants
    │   ├── thumbnails/
    │   ├── crops/
    │   └── previews/
    └── manifests/       # Asset indices & metadata
        ├── images-index.json
        └── images-index.md
```

### Asset Rules

* **Classification:** Categorize files strictly by source type and lifecycle stage.
* **Decoupled Metadata:** Save alt-text, dimensions, compression targets, prompt text, engine adaptation parameters, and cryptographical hashes inside the database and manifest files.
* **Volume Gating:** Do not push massive disposable generated batches to Git. Keep only what is strategically significant, and use the central database to point to active local or cloud asset file paths.

---

## 🚀 Execution & Verification Standard

Every worker must adhere to the **7-Step Sequence** for every single task:
1. **Inventory:** Check current repository structure and file boundaries.
2. **Summarize:** Summarize the target objective and execution strategy.
3. **Classify:** Determine task risk level and code impact.
4. **Propose:** Outline planned file edits before modifying active documents.
5. **Implement Cleanly:** Write modular, well-named, and explicit edits.
6. **Update Docs:** Log modifications in plans, dashboards, and run briefs.
7. **Archive Leftovers:** Remove temporary scratch scripts and tidy up.

The final test for any change: *Does this make STAX calmer, clearer, and more trustworthy as a business system?*
