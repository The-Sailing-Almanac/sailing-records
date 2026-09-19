# Sail Southern Route Footprint

This document lists all frontend and backend routing definitions for sailsouthern.com, categorized by access governance classes.

## Route Class Definitions

1. **Public Approved:** Open routes accessible to the general public.
2. **Public Blocked:** Standard public client routes currently restricted under lockout mode.
3. **Private Internal:** Administrative and internal tools protected via headers/cookies validation.
4. **Framework/System:** Under-the-hood routing endpoints for assets and next engine code.

---

## Route Inventory Outline

- `/` [Public Approved]
  - `/about` [Public Blocked]
  - `/admin` [Private Internal]
    - `/admin/routes` [Private Internal]
  - `/blog` [Public Blocked]
    - `/blog/[slug]` [Public Blocked]
  - `/boats` [Public Blocked]
    - `/boats/[id]` [Public Blocked]
  - `/builder` [Public Blocked]
  - `/daily` [Public Blocked]
    - `/daily/latest` [Public Blocked]
    - `/daily/[date]` [Public Blocked]
      - `/daily/[date]/[section]` [Public Blocked]
  - `/entities` [Public Blocked]
    - `/entities/[slug]` [Public Blocked]
  - `/handicap/estimate` [Public Blocked]
  - `/handicap/fleet-intel` [Public Blocked]
  - `/handicap/phrf` [Public Blocked]
  - `/submit` [Public Blocked]
  - `/support` [Public Blocked]
  - `/supporters` [Public Blocked]
  - `/weekly-edition` [Public Blocked]
    - `/weekly-edition/[date]` [Public Blocked]
      - `/weekly-edition/[date]/[section]` [Public Blocked]
  - `/api` [Framework/System]
  - `/_next` [Framework/System]
