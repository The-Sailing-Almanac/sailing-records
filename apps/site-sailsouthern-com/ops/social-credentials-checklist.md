# Social Credentials Checklist
# Sail Southern / Sailing Almanac — Phase 10
# Date: 2026-05-29
# Use this doc when setting up platform accounts and adding credentials to .env

---

## Pre-Flight: Brand Decisions

Before creating any accounts, confirm these are final:

- [ ] **Publication name:** Sailing Almanac (or Sail Southern?)
- [ ] **Handle:** `@sailingalmanac` OR `@sailsouthern` — pick ONE, use consistently
- [ ] **Short bio:** e.g. "Daily sailing news, race coverage, and coastal dispatches. sailsouthern.com"
- [ ] **Website URL:** https://sailsouthern.com
- [ ] **Avatar image:** Compass rose / Sailing Almanac logo (1:1 ratio, ≥400x400px)

---

## Platform 1 — Mastodon

### .env keys required

```bash
MASTODON_INSTANCE_URL=https://mastodon.social
MASTODON_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxx
```

### Setup steps

1. Go to [mastodon.social](https://mastodon.social) (or choose your preferred instance)
2. Create account with your chosen handle (e.g. `@sailingalmanac@mastodon.social`)
3. Fill in profile: Display name, Bio, Website URL, Avatar
4. Go to **Preferences → Development → New Application**
   - Application name: `Sail Southern Publisher`
   - Redirect URI: `urn:ietf:wg:oauth:2.0:oob`
   - Scopes: `read write`
5. Click **Submit**, then copy the **Access token**

```bash
MASTODON_INSTANCE_URL=https://mastodon.social
MASTODON_ACCESS_TOKEN=<paste_access_token_here>
```

### Profile checklist

- [ ] Handle created (e.g. `@sailingalmanac@mastodon.social`)
- [ ] Display name: `Sailing Almanac`
- [ ] Bio: `Daily sailing news, race coverage, and coastal dispatches. sailsouthern.com`
- [ ] Website: `https://sailsouthern.com`
- [ ] Avatar uploaded
- [ ] Bot flag: Set `This is a bot account` in profile settings (automated account)
- [ ] `rel="me"` link on website pointing to Mastodon profile (for verification badge)

### Where used in codebase

- `packages/stax-social/src/adapters/mastodon.ts` — publishToMastodon()
- `apps/api/src/routes/v1.ts` — Publishing credentials readiness card
- `workers/federation/src/` — social publishing worker

---

## Platform 2 — Nostr

### .env keys required

```bash
NOSTR_PRIVATE_KEY=nsec1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band
```

### Setup steps

**Option A: Generate via nostr-tools (recommended)**

```powershell
npx tsx -e "
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
const sk = generateSecretKey();
const pk = getPublicKey(sk);
console.log('nsec:', nip19.nsecEncode(sk));
console.log('npub:', nip19.npubEncode(pk));
" 2>&1
```

> ⚠️ Back up the `nsec` key securely. If lost, you cannot recover the identity.

**Option B: Use a Nostr client** (Damus, Amethyst, Primal) — create account,
then export the private key in nsec format.

After generating:
- Paste the `nsec...` value as `NOSTR_PRIVATE_KEY`
- Note the `npub...` value — this is your public identity for documentation

### Profile metadata (broadcast after setup)

```powershell
# Run once after NOSTR_PRIVATE_KEY is set to publish profile metadata
npx tsx scripts/update-nostr-profile.ts
```

If `update-nostr-profile.ts` doesn't exist yet, you can set profile via any
Nostr client using the same private key.

Profile fields:
- **name:** `Sailing Almanac`
- **about:** `Daily sailing news, race coverage, and coastal dispatches. sailsouthern.com`
- **website:** `https://sailsouthern.com`
- **picture:** URL to avatar image (must be publicly accessible HTTPS URL)
- **lud16:** Your Lightning address (once Alby is configured) — enables zap/V4V

### NIP-05 Verification (optional but recommended)

Add NIP-05 verification so your profile shows as verified:

1. Create file `apps/web/public/.well-known/nostr.json`:
   ```json
   {
     "names": {
       "sailingalmanac": "<npub_public_key_hex>"
     }
   }
   ```
2. Set `nip05` in your Nostr profile metadata: `sailingalmanac@sailsouthern.com`

### Relay selection

Use at least 3 for redundancy:

```bash
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,wss://relay.nostr.band,wss://relay.primal.net
```

### Where used in codebase

- `packages/stax-social/src/adapters/nostr.ts` — publishToNostr()
- `apps/api/src/routes/v1.ts` — Publishing credentials readiness card

---

## Platform 3 — Bluesky

### .env keys required

```bash
BLUESKY_IDENTIFIER=sailingalmanac.bsky.social
BLUESKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

> ⚠️ `BLUESKY_PASSWORD` must be an **App Password**, NOT your login password.

### Setup steps

1. Create account at [bsky.app](https://bsky.app)
   - Handle: e.g. `sailingalmanac.bsky.social`
2. Fill in profile: Display name, Bio, Avatar
3. Go to **Settings → Privacy and Security → App Passwords**
4. Click **Add App Password**
   - Name: `ss-publisher`
5. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

```bash
BLUESKY_IDENTIFIER=sailingalmanac.bsky.social
BLUESKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### Custom domain handle (optional)

Change your handle from `sailingalmanac.bsky.social` to `sailsouthern.com`:

1. **Settings → Change handle → I have my own domain**
2. Add this DNS TXT record to your domain:
   ```
   Host: _atproto
   Value: did=did:plc:<your_did>
   ```
3. Click **Verify Text File** in Bluesky settings

Your DID is shown in **Settings → Advanced → Your DID**.

### Profile checklist

- [ ] Account created at bsky.app
- [ ] Display name: `Sailing Almanac`
- [ ] Description: `Daily sailing news, race coverage, and coastal dispatches. sailsouthern.com`
- [ ] Website / link: `https://sailsouthern.com`
- [ ] Avatar uploaded
- [ ] App password created (NOT login password)
- [ ] Custom domain handle configured (optional)

### Where used in codebase

- `packages/stax-social/src/adapters/bluesky.ts` — publishToBluesky()
- `apps/api/src/routes/v1.ts` — Publishing credentials readiness card

---

## Platform 4 — Alby / Lightning (V4V)

> Operator is handling Alby setup separately. Document below is for reference.

### .env keys required (once Alby is configured)

```bash
LIGHTNING_ADDRESS=yourname@getalby.com   # or other Lightning address provider
BOLT12_OFFER=                            # Optional: static BOLT12 offer string
```

### Setup steps

1. Go to [getalby.com](https://getalby.com) and create an account
2. Your Lightning address will be: `yourname@getalby.com`
3. Optionally create a BOLT12 offer in Alby settings

### Where used in codebase

- `apps/api/src/routes/v1.ts` — Lightning readiness card
- Nostr profile `lud16` field (set to Lightning address for zap support)

---

## After Adding All Credentials

1. Restart the API server:
   ```powershell
   # Stop current dev server, then:
   npm run dev --workspace=almanac-api
   ```

2. Check readiness dashboard:
   ```
   Admin → Readiness tab
   ```
   All social/analytics/archive cards should show ✅ Ready.

3. Run smoke test:
   ```powershell
   npx tsx scripts/generate-micro-edition.ts --dry-run
   ```
   Verify: Mastodon, Nostr, and Bluesky legs all show `WOULD post: ...` in dry-run output.

4. Trigger a manual live publish from the dashboard:
   ```
   Admin → Scheduler → Publish now
   ```
   Verify the post appears on each platform within 30 seconds.

---

## Readiness Summary

Run this to see all status at once:

```bash
curl -H "X-Admin-Key: $ADMIN_API_KEY" http://localhost:4000/api/v1/system/readiness | npx jq '.integrations[] | {name: .name, status: .status, missing: .missing}'
```

Expected result once all credentials are in .env:

```json
{"name": "Publishing credentials", "status": "ready", "missing": []}
{"name": "Archive credentials", "status": "ready", "missing": []}
{"name": "Analytics — Measurement Protocol", "status": "ready", "missing": []}
{"name": "Analytics — Data API (dashboard)", "status": "ready", "missing": []}
{"name": "Newsletter generation", "status": "ready", "missing": []}
{"name": "Email delivery", "status": "ready", "missing": []}
{"name": "Lightning / Value-for-Value", "status": "ready", "missing": []}
```
