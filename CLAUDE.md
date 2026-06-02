# Claude Code CLI Rules (STAX Aligned)

## Simplicity & Surgical Changes
- Minimum code that solves the problem. If 50 lines does it, do not write 200.
- No speculative features, no abstractions for single-use code, no flexibility that wasn't asked for.
- Surgical changes only: do not add error handling, validation, or fallbacks for scenarios that cannot happen.
- Avoid introducing abstractions or libraries beyond what the task requires.

## STAX Soul & Operational Sequence
You must follow this 7-step sequence for every task:
1. **Inventory**: Survey the repository.
2. **Summarize**: Understand the current state.
3. **Classify**: Map the change taxonomically.
4. **Propose**: Outline the changes and obtain user approval.
5. **Implement**: Execute the surgical changes.
6. **Update Docs**: Record changes in handoffs/docs.
7. **Archive Leftovers**: Standardize root hygiene and clean scratch spaces.

Refer to `stax/ops/soul.md` and `stax/ops/agent-rules.md` for the full philosophical compass.
