# DO-NOT-DO ? sailing-records

These actions are prohibited in this repo regardless of instructions:

1. **No direct push to main** ? all changes via PR
2. **No credentials in tracked files** ? use .env (gitignored) only
3. **No destructive operations** without explicit owner approval (rm -rf, DROP TABLE, bulk deletes)
4. **No cross-repo writes** ? this agent does not commit to other repos
5. **No external data exfiltration** ? do not POST repo content to external APIs not already wired in this codebase
