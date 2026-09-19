---
title: "Email Config — sailsouthern.com"
domain: sailsouthern.com
updated_at: "2026-05-23"
email_provider: ProtonMail
type: reference
---

# Email Config: sailsouthern.com

**Provider:** ProtonMail

## Email DNS Records

| Type | Name | Value |
|------|------|-------|
| CNAME | `protonmail._domainkey` | `protonmail.domainkey.dkjj4465nyk52cuiysb5b7ygzenrohgscommicmx6o3ypts7trjla.domains.proton.ch` |
| CNAME | `protonmail2._domainkey` | `protonmail2.domainkey.dkjj4465nyk52cuiysb5b7ygzenrohgscommicmx6o3ypts7trjla.domains.proton.ch` |
| CNAME | `protonmail3._domainkey` | `protonmail3.domainkey.dkjj4465nyk52cuiysb5b7ygzenrohgscommicmx6o3ypts7trjla.domains.proton.ch` |
| MX | `@` | `10 mail.protonmail.ch` |
| MX | `@` | `20 mailsec.protonmail.ch` |
| TXT | `@` | `google-site-verification=ouUYoFHb_Dc4X8260T5QRC4aiDfRh9GenJg2MbwEwfI` |
| TXT | `@` | `protonmail-verification=aebc5cea2e84af9e26460e9687c39e5e00414672` |
| TXT | `@` | `v=spf1 include:_spf.protonmail.ch mx ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine` |


## Notes

ProtonMail fully configured (SPF + 3x DKIM + DMARC quarantine). short.io link shortener on go.sailsouthern.com. Google site verification TXT present. Stray A record (49.13.201.194) — investigate.
