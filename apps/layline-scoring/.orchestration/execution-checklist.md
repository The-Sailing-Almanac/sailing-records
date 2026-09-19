# STAX Execution Checklist

Every agent session in this repo follows this exact sequence.

1. **Inventory**
   - Identify touched files, dependencies, and protected paths.
   - Confirm lifecycle state and horizon block are present.

2. **Summarize**
   - State the current architecture and the change target in plain English.
   - Note any uncertainty before editing.

3. **Classify**
   - Assign the task to Tier 1, Tier 2, or Tier 3 using `.orchestration/SAFE-TASKS.md`.
   - If classification is uncertain, stop.

4. **Propose (wait for approval)**
   - Present a small implementation plan.
   - Do not begin risky work until the requested approval path is satisfied.

5. **Implement**
   - Make the smallest complete change.
   - Preserve root hygiene and avoid side quests.

6. **Update docs**
   - Update README, examples, governance notes, or changelog entries if behavior changed.

7. **Archive leftovers / root hygiene**
   - Remove scratch artifacts.
   - Ensure logs live in `/runs/`, data lives in `/data/` or `/ops/`, and the root contains only approved files.
