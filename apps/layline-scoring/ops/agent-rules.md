---
category: software
plane_id: 
profit_likelihood: high
project: None
status: ready
tags: []
title: "agent-rules"
type: "ops-guide"
updated_at: "2026-05-17T19:11:22Z"
---

# STAX Agent Rules

This document outlines the strict operational rules for any AI agent, coding companion, or automated worker operating inside the `stax` repository. You must follow these direct imperatives at all times without exception.

---

## 🚨 Root & Directory Integrity

1. **Keep Root Sacred and Sparse:**
   * Do not create loose files, planning notes, scratch scripts, databases, or random assets in root.
   * Allowed root files: `stax.py`, `README.md`, `.cursorrules`, `.gitignore`.
2. **No Databases in Root:** All native databases (`.db`), JSON data dumps, or raw staging logs must reside under `ops/` or `data/`.
3. **No Generated Assets in Root:** Store all generated files, screenshots, or design assets under `assets/generated/`.
4. **No Raw Imports in Root:** All handoffs, transcripts, and backup files must be saved under `handoffs/incoming/`.

---

## 📂 Handoff & Processing Boundaries

1. **Preserve Raw Imports:** Save original files inside `handoffs/incoming/` before doing any transformation or cleaning.
2. **Standardize Incoming Folders:** Route files strictly into:
   * `handoffs/incoming/raw/` (unstructured)
   * `handoffs/incoming/evernote/` (raw ENEX exports)
   * `handoffs/incoming/obsidian/` (vault data)
   * `handoffs/incoming/exported/` (structured text)
   * `handoffs/incoming/review/` (requires operator intervention)
3. **Save Outputs Separately:** Write all summaries, classifications, and de-duplication reports under `handoffs/processed/`.

---

## 🧹 Cleanup & Pruning Discipline

1. **Re-home Orphaned Files:** Do not leave temporary scripts or staging logs lying in active directories. Move them to `archive/` or delete them.
2. **Keep Git Clean:** Do not check in massive media logs or disposable output batches. Ensure your `.gitignore` is updated and current.
3. **Conscise Logging:** Write clear, plain-English summaries at the top of all run reports and store verbose stack traces separately.

---

## 🥗 Content Integrity & Quality Control

1. **Evernote Intake Stripping:** Before parsing or classifying `.enex` files, run a safe cleaning pass to strip out HTML tags, style boundaries, layout wrappers, and forwarded-email headers.
2. **Google/Schema.org Recipe Standards:** When processing recipes, preserve 100% accuracy and structure data into schema-friendly keys:
   * `name` (recipe title)
   * `description` (brief overview)
   * `recipeIngredient` (ingredients list array)
   * `recipeInstructions` (numbered preparation steps array)
   * `prepTime` / `cookTime` (if available)

---

## ⛓️ Bounded Staged Roadmap Execution

To protect the workspace and ensure auditable progress, the system enforces a structured **6-Phase Roadmap**:
* **Phase 1:** Rules & Reorganization (Align directories and update rule docs).
* **Phase 2:** ENEX Intake & Cleanup (Strip HTML, categorize notes, standardize recipes).
* **Phase 3:** Database & Review Table Build (Create JSON-relational schema, provenance tags, compile dashboard).
* **Phase 4:** POD Niche Expansion (Double niches, generate 50+ ideas per niche, tags, 20-engine prompt templates).
* **Phase 5:** Content Queue Design (Generate writing expansions, social/blog schedule queues, landing pages).
* **Phase 6:** Threshold & Rerun Logic (Build overnight comparison scripts, limits, rerun guide).

*You must stop at the end of each phase, log a structured Run Brief under `runs/`, and obtain verification before proceeding to the next stage.*
