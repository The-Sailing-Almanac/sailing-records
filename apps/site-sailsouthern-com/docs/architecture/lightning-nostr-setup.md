# Lightning & Nostr Identity Configuration

This document describes how Sailsouthern/Sailing Almanac integrates Lightning payments and Nostr identity metadata to support NIP-57 Zaps and value-for-value monetization.

## 1. Identity & Monetization Standard
To facilitate reader monetization (zaps), the Almanac exposes two primary fields in its Nostr Kind-0 profile metadata:
- **`lud16` (Lightning Address)**: Standard human-readable address (e.g. `user@domain.com` or `almanac@sailsouthern.com`) for LNURL-pay resolution.
- **`bolt12` (BOLT12 Offer)**: Static payment offers for modern lightning networks, bypassing the need for web/DNS resolution.

---

## 2. Profile Metadata Fields (Kind-0)

Nostr clients query the Kind-0 profile metadata event to display user info and enable the "Zap" button. The payload JSON structure:

```json
{
  "name": "Sailing Almanac",
  "display_name": "Sailing Almanac",
  "about": "Autonomous sailing newsletter, regatta results, and fleet analytics.",
  "website": "https://sailsouthern.com",
  "lud16": "almanac@sailsouthern.com",
  "bolt12": "lno1qgspemnv9..."
}
```

- **`lud16`**: Standard client-side lookup. E.g. when zapping, the client calls:
  `GET https://sailsouthern.com/.well-known/lnurlp/almanac`
  which returns the payment parameters (min/max sendable, metadata, callback URL).
- **`bolt12`**: Standardized payment offering (NIP-12). Modern wallets parse the static offer directly to fetch an invoice from the node.

---

## 3. Environment Inputs & Configuration

Configure these parameters in your local `.env` file (never commit these values to source control):

```bash
# Lightning Configuration
LIGHTNING_ADDRESS=almanac@sailsouthern.com
BOLT12_OFFER=lno1qgspemnv9...
```

To update the profile metadata on all configured relays, run the following command:

```bash
npm run update-nostr-profile
```

This script:
1. Loads the environment variables.
2. Checks for `NOSTR_PRIVATE_KEY` to sign the event.
3. Constructs the Kind-0 event metadata with the `lud16` and `bolt12` fields.
4. Broadcasts the signed Kind-0 event to `NOSTR_RELAYS`.

---

## 4. Zap Client Compatibility

To ensure seamless donation collection, the identity configurations are verified against major Nostr clients:

| Client | lud16 (LNURL) Support | BOLT12 Support | Zap Interaction |
|---|---|---|---|
| **Damus** (iOS) | ✅ Full | ⚠️ Experimental | Renders Zap button, queries LNURL-pay endpoints |
| **Amethyst** (Android) | ✅ Full | ✅ Full | Native Zap support, resolves BOLT12 offers |
| **Primal** (Web/Mobile) | ✅ Full | ❌ Planned | Custom Primal wallet integrations |
| **Mutiny Wallet** | ✅ Full | ✅ Full | Decodes static offers directly |
