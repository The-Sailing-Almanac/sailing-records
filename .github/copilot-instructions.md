# GitHub Copilot Instructions (STAX Aligned)

## Simplicity & Surgical Changes
- Minimum code that solves the problem. If 50 lines does it, do not write 200.
- No speculative features, no abstractions for single-use code, no flexibility that wasn't asked for.
- Surgical changes only: do not add error handling, validation, or fallbacks for scenarios that cannot happen.

## STAX Soul & Operational Sequence
Sequence: **Inventory** ➔ **Summarize** ➔ **Classify** ➔ **Propose** ➔ **Implement** ➔ **Update Docs** ➔ **Archive Leftovers**

Refer to `stax/ops/soul.md` and `stax/ops/agent-rules.md` for the full philosophical compass.
