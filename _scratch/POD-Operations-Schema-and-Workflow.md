# Print-on-Demand Operations — Schema & Workflow Reference

A working reference for the Airtable base. Read top-to-bottom once; after that, jump via the table of contents.

---

## Table of contents

1. [ID conventions](#id-conventions)
2. [Schema overview](#schema-overview)
3. [Tables and fields](#tables-and-fields)
4. [Variants modeling](#variants-modeling)
5. [Seed data — top 20 lists](#seed-data--top-20-lists)
6. [Common product types](#common-product-types)
7. [Reference dimensions](#reference-dimensions)
8. [The iteration workflow](#the-iteration-workflow)
9. [Airtable formulas cheat sheet](#airtable-formulas-cheat-sheet)
10. [Views and dashboards](#views-and-dashboards)
11. [Build order checklist](#build-order-checklist)

---

## ID conventions

Every primary entity gets a prefixed, zero-padded ID generated from an autonumber field plus a formula. The formula field is set as the **primary field** so it shows up as the linked-record label everywhere.

| Table | Prefix | Width | Formula |
|---|---|---|---|
| Designs | DES | 6 | `"DES-" & RIGHT("000000" & {Autonumber}, 6)` |
| Design Groups | GRP | 6 | `"GRP-" & RIGHT("000000" & {Autonumber}, 6)` |
| Generation Attempts (recipes) | ATT | 6 | `"ATT-" & RIGHT("000000" & {Autonumber}, 6)` |
| Generation Runs | RUN | 6 | `"RUN-" & RIGHT("000000" & {Autonumber}, 6)` |
| Renders | RND | 6 | `"RND-" & RIGHT("000000" & {Autonumber}, 6)` |
| Listings | LST | 6 | `"LST-" & RIGHT("000000" & {Autonumber}, 6)` |
| Variants | VAR | 6 | `"VAR-" & RIGHT("000000" & {Autonumber}, 6)` |
| Sales | SAL | 6 | `"SAL-" & RIGHT("000000" & {Autonumber}, 6)` |
| Niches | NCH | 3 | `"NCH-" & RIGHT("000" & {Autonumber}, 3)` |
| Brands | BRD | 3 | `"BRD-" & RIGHT("000" & {Autonumber}, 3)` |
| Printers | PRT | 3 | `"PRT-" & RIGHT("000" & {Autonumber}, 3)` |
| Outlets | OUT | 3 | `"OUT-" & RIGHT("000" & {Autonumber}, 3)` |
| Product Types | TYP | 3 | `"TYP-" & RIGHT("000" & {Autonumber}, 3)` |
| Image Generators | GEN | 3 | `"GEN-" & RIGHT("000" & {Autonumber}, 3)` |

Reference tables (Sizes, Colors, Finishes, Phone Models, Materials, Tags) can use simple text or short-prefix IDs at your discretion — they don't need formal numbering.

---

## Schema overview

The base has four conceptual layers.

**Reference layer** (small, slow-changing): Niches, Tags, Image Generators, Product Types, Printers, Outlets, Brands, Sizes, Colors, Finishes, Phone Models, Materials.

**Creative layer**: Design Groups → Designs.

**Generation layer**: Generation Attempts (recipes) → Generation Runs → Renders. A Render can have a parent Render for upscales/variations.

**Commercial layer**: Listings → Variants → Sales.

A Listing pulls from the creative side (which Render is on the product) and the commercial side (which Outlet, Printer, Brand, Product Type). Variants hang off Listings and pull from the reference dimension tables (Sizes, Colors, etc.).

---

## Tables and fields

### Niches

Hierarchical category system. Self-referencing.

- `Niche ID` (formula primary)
- `Name` (text) — e.g., "Sailing — Cruising"
- `Parent Niche` (link to Niches, self) — for hierarchy
- `Full Path` (formula) — walks the parent chain for clean display
- `Description` (long text)
- `Designs` (rollup) — count
- `Listings` (rollup) — count

### Design Groups

Container for variations on a single concept ("Sailing Sunset Series").

- `Group ID` (formula primary)
- `Group Name` (text)
- `Concept` (long text)
- `Niche` (link to Niches)
- `Status` (single-select: `Active`, `Paused`, `Retired`)
- `Designs` (link to Designs, reverse)
- `Design Count` (rollup count)

### Designs

The master creative record. One row = one creative concept, generator-agnostic.

- `Design ID` (formula primary)
- `Title` (text)
- `Status` (single-select: `Concept`, `Generating`, `Refining`, `Ready for Production`, `Listed`, `Retired`)
- `Design Group` (link to Design Groups)
- `Niche` (link to Niches)
- `Tags` (link to Tags, multi)
- `Concept` (long text — what the design is about)
- `Mood / Tone` (long text or multi-select)
- `Color Palette` (long text or multi-select with hex swatches)
- `Composition Notes` (long text)
- `Style References` (attachment — mood board)
- `Source Inspiration` (URL field, multi-line)
- `Created Date` (created time)
- `Last Updated` (last modified)
- `Owner / Creator` (collaborator or text)
- `Generation Attempts` (reverse link)
- `Renders` (reverse link via attempts → runs)
- `Listings` (reverse link)
- `Notes` (long text)

### Image Generators

Catalog of every tool you use, plus a `Self / Manual` row for hand work.

- `Generator ID` (formula primary)
- `Name` (text)
- `Vendor` (text)
- `Model Versions` (long text or multi-select — Midjourney v6, v7, etc.)
- `Strengths` (long text)
- `Weaknesses` (long text)
- `Typical Parameters` (long text)
- `Commercial Rights Notes` (long text)
- `Pricing Tier` (single-select)
- `Active` (checkbox — toggle off if you stop using one)

### Generation Attempts (recipes)

The prompt configuration. One row = one recipe that can be run any number of times.

- `Recipe ID` (formula primary, prefix ATT)
- `Design` (link to Designs)
- `Generator` (link to Image Generators)
- `Model Version` (text)
- `Prompt Text` (long text)
- `Negative Prompt` (long text)
- `Aspect Ratio` (single-select: `1:1`, `2:3`, `3:2`, `9:16`, `16:9`)
- `Parameters` (long text — JSON-style or freeform: steps, CFG, seed strategy, sampler)
- `Seed Strategy` (single-select: `fixed`, `random`)
- `Recipe Notes` (long text)
- `Status` (single-select: `Active`, `Abandoned`, `Locked-in`)
- `Runs` (reverse link)
- `Times Run` (rollup count of Runs)
- `Best Quality` (rollup max of related Render quality)

### Generation Runs

Each individual execution of a recipe.

- `Run ID` (formula primary)
- `Recipe` (link to Generation Attempts)
- `Run Number` (number — sequential within recipe)
- `Run Date` (date/time)
- `Seed` (text — actual seed used)
- `Raw Output Count` (number)
- `Raw Outputs` (attachment — full grid before pruning)
- `Run Notes` (long text)
- `Outcome` (single-select: `Keepers found`, `No keepers`, `Partial — re-run planned`, `Failed`)
- `Renders` (reverse link)
- `Keeper Count` (rollup count)

### Renders

Curated, kept outputs. Supports lineage via self-link.

- `Render ID` (formula primary)
- `Run` (link to Generation Runs)
- `Design` (lookup from Run → Recipe → Design, for convenience)
- `File` (attachment)
- `Resolution` (text — e.g., "1024×1024")
- `Format` (single-select: `PNG`, `JPG`, `WEBP`, `TIFF`, `SVG`, `PSD`)
- `Iteration Type` (single-select: `Initial`, `Upscale`, `Subtle Variation`, `Strong Variation`, `Reroll`, `Manual Edit`, `External Tool`)
- `Parent Render` (link to Renders, self) — set when this is a derivative
- `Batch Position` (number — 1–4 for grid position)
- `Quality Rating` (rating, 1–5)
- `Post Processing Notes` (long text)
- `Approved for Listing` (checkbox)
- `Listings` (reverse link)
- `Lineage Depth` (formula or rollup)

### Brands

Storefront identities.

- `Brand ID` (formula primary)
- `Brand Name` (text)
- `Primary Niche` (link to Niches)
- `Voice / Tone` (long text)
- `Visual Identity Notes` (long text)
- `Logo` (attachment)
- `Outlets Used` (link to Outlets, multi)
- `Listings` (reverse link)

### Printers

POD fulfillment companies.

- `Printer ID` (formula primary)
- `Name` (text)
- `Type` (single-select: `Print Provider`, `Print Network`, `Marketplace + Print`)
- `Product Types Offered` (link to Product Types, multi)
- `Outlets Integrated With` (link to Outlets, multi)
- `Base Cost Notes` (long text)
- `Quality Notes` (long text)
- `Turnaround Time` (text)
- `Shipping Geography` (multi-select: `US`, `EU`, `UK`, `CA`, `AU`, `Global`)
- `Active` (checkbox)
- `Listings` (reverse link)

### Outlets

Where products are sold.

- `Outlet ID` (formula primary)
- `Name` (text)
- `Type` (single-select: `Marketplace`, `Own Store`, `Hybrid`, `Print Marketplace`)
- `Print Integrated` (checkbox — true if it prints + sells, false if it needs an external printer)
- `Compatible Printers` (link to Printers, multi)
- `Audience Notes` (long text)
- `Fee Structure Notes` (long text)
- `Account URL` (URL)
- `Active` (checkbox)
- `Listings` (reverse link)

### Product Types

Catalog of blank items.

- `Type ID` (formula primary)
- `Name` (text)
- `Category` (single-select: `Apparel`, `Drinkware`, `Wall Art`, `Stationery`, `Tech Accessories`, `Bags`, `Home Decor`, `Stickers`, `Books`, `Jewelry`)
- `Print Method` (multi-select: `DTG`, `Sublimation`, `Embroidery`, `UV Print`, `Cut-and-Sew`, `AOP`, `Engraving`, `Heat Transfer`)
- `Print Area Dimensions` (text)
- `Variant Attributes Used` (multi-select: `Size`, `Color`, `Finish`, `Phone Model`, `Material`)
- `Notes` (long text)
- `Listings` (reverse link)

### Listings

The four-way join: Render × Product Type × Outlet × Brand. One row per real-world listing URL.

- `Listing ID` (formula primary)
- `Design` (lookup from Render — for convenience)
- `Render` (link to Renders) — the specific image used
- `Product Type` (link to Product Types)
- `Outlet` (link to Outlets)
- `Printer` (link to Printers) — empty if outlet is print-integrated
- `Brand` (link to Brands)
- `SKU` (text)
- `Listing URL` (URL)
- `Listing Title` (text)
- `Listing Description` (long text)
- `Keywords / SEO Tags` (long text or multi-select)
- `Price` (currency) — base price; variants can override
- `Listed Date` (date)
- `Status` (single-select: `Draft`, `Live`, `Paused`, `Removed`)
- `Variants` (reverse link)
- `Variant Count` (rollup count)
- `Sales` (reverse link)
- `Lifetime Revenue` (rollup sum)
- `Lifetime Units` (rollup sum)
- `Notes` (long text)

### Variants

Per-SKU rows. Hangs off Listings; links to whichever reference dimensions apply.

- `Variant ID` (formula primary)
- `Listing` (link to Listings)
- `Size` (link to Sizes — optional)
- `Color` (link to Colors — optional)
- `Finish` (link to Finishes — optional)
- `Phone Model` (link to Phone Models — optional)
- `Material` (link to Materials — optional)
- `Variant SKU` (text)
- `Printer Variant ID` (text — the fulfiller's own SKU on their end)
- `Price Override` (currency — empty inherits from Listing)
- `Effective Price` (formula)
- `Mockup Image` (attachment)
- `Status` (single-select: `Active`, `Out of Stock`, `Retired`)
- `Sales` (reverse link)
- `Variant Display Name` (formula — combines linked dimensions for readable label)

### Sales

Transactions. Optional at start, essential at scale.

- `Sale ID` (formula primary)
- `Variant` (link to Variants)
- `Listing` (lookup, denormalized)
- `Sale Date` (date)
- `Quantity` (number)
- `Gross Revenue` (currency)
- `Outlet Fee` (currency)
- `Printer Cost` (currency)
- `Shipping Cost` (currency)
- `Net Profit` (formula)
- `Buyer Country` (text — for shipping geography analysis)
- `Order Reference` (text)
- `Notes` (long text)

### Reference dimension tables

**Sizes**
- `Size Name` (text — `S`, `M`, `L`, `XL`, `2XL`, `11oz`, `15oz`, `5×7"`, `8×10"`, `12×18"`, etc.)
- `Category` (single-select: `Apparel-Letter`, `Apparel-Numeric`, `Drinkware-Volume`, `Print-Dimensions`, `Sticker-Dimensions`)
- `Sort Value` (number — for ordering)
- `Variants Using This` (reverse link)

**Colors**
- `Color Name` (text)
- `Hex Code` (text)
- `Color Family` (single-select: `Warm`, `Cool`, `Neutral`, `Earth`)
- `Apparel Industry Code` (text — Bella+Canvas, Gildan codes if relevant)
- `Variants Using This` (reverse link)

**Finishes**
- `Finish Name` (text — `Matte`, `Gloss`, `Satin`, `Holographic`, `Glitter`, `Foil`, `Transparent`)
- `Applies To` (link to Product Types, multi)
- `Variants Using This` (reverse link)

**Phone Models**
- `Model Name` (text — `iPhone 16 Pro`, `iPhone 16`, `Galaxy S25 Ultra`, etc.)
- `Brand` (single-select: `Apple`, `Samsung`, `Google`, `OnePlus`, `Other`)
- `Year Released` (number)
- `Active` (checkbox — turn off when models go out of catalog)
- `Variants Using This` (reverse link)

**Materials**
- `Material Name` (text — `100% Cotton`, `50/50 Blend`, `Tri-Blend`, `Polyester`, `Ceramic`, `Stainless Steel`, `Sterling Silver`, `Canvas`, `Premium Matte Paper`)
- `Category` (single-select: `Fabric`, `Drinkware`, `Paper`, `Metal`, `Plastic`, `Glass`)
- `Variants Using This` (reverse link)

**Tags**
- `Tag Name` (text)
- `Category` (single-select: `Subject`, `Style`, `Mood`, `Audience`, `Occasion`, `SEO`)
- `Designs Using` (reverse link)

---

## Variants modeling

A Listing has many Variants. Each Variant uses 1–3 of the available reference dimensions, depending on the product type. Don't try to force every variant to populate every dimension; leave the irrelevant ones empty.

| Product type | Typical dimensions used |
|---|---|
| T-shirt, hoodie, tank | Size, Color, Material |
| Mug | Size (volume), Color, Finish |
| Sticker | Size, Finish |
| Poster, art print | Size, Material, Finish |
| Phone case | Phone Model, Finish |
| Tote bag | Size, Color, Material |
| Notebook | Size, Color |
| Necklace, bracelet | Material, Size (length) |
| Hat | Size, Color, Material |
| Throw pillow | Size, Material |

Set up a `Variant Display Name` formula like:
```
{Listing} & " — " &
IF({Color}, {Color} & " / ", "") &
IF({Size}, {Size} & " / ", "") &
IF({Finish}, {Finish} & " / ", "") &
IF({Phone Model}, {Phone Model} & " / ", "") &
IF({Material}, {Material}, "")
```

This gives clean labels like `LST-000142 — Black / L / Cotton`.

---

## Seed data — top 20 lists

These are the populations to load into the reference tables on day one. Trim to the ones you actually use; add the rest as needed.

### Top 20 AI image generators (May 2026)

| # | Generator | Vendor | Best for |
|---|---|---|---|
| 1 | Midjourney v7 | Midjourney | Artistic, stylized, aesthetic-driven work |
| 2 | FLUX.2 / FLUX.1.1 Pro | Black Forest Labs | Commercial photoreal, high technical quality |
| 3 | Nano Banana 2 / Pro | Google (Gemini 3 Pro Image) | Photorealism, character consistency, 4K |
| 4 | GPT Image 2 / 1.5 | OpenAI | Text rendering, prompt adherence, ChatGPT integration |
| 5 | Adobe Firefly Image 5 | Adobe | Commercial-safe (licensed training), Photoshop integration |
| 6 | Ideogram 3 / 2 | Ideogram | Typography, text-in-image, posters |
| 7 | Recraft V4 | Recraft | Brand consistency, vector output, design assets |
| 8 | Stable Diffusion 3.5 / SDXL | Stability AI | Open-source, custom training, full control |
| 9 | Imagen 4 | Google | Photorealistic faces, landscapes, text |
| 10 | Leonardo AI | Leonardo | Game/concept assets, fine-tuned style models |
| 11 | Grok Imagine | xAI | Native image + video |
| 12 | Aurora | xAI | Quality and realism, newer entrant |
| 13 | Krea AI | Krea | Real-time generation, iteration speed |
| 14 | Canva Magic Studio | Canva | Workflow integration, template-ready output |
| 15 | Playground AI | Playground | Mid-quality, accessible UI |
| 16 | NightCafe | NightCafe Studio | Multi-model access, community |
| 17 | DALL-E 3 (legacy API) | OpenAI | API-only legacy access |
| 18 | Bing Image Creator | Microsoft | Free DALL-E based generation |
| 19 | Magnific AI | Magnific | Upscaling and detail enhancement (paired with others) |
| 20 | Self / Manual | — | Hand illustration, photography, photo editing |

Track each as a row in the Image Generators table. For models that have multiple versions (Midjourney v6 vs v7), use the `Model Versions` field to enumerate, and capture the specific version on the Recipe row.

### Top 20 printers / POD fulfillment companies (May 2026)

| # | Printer | Type | Notable for |
|---|---|---|---|
| 1 | Printful | Print Provider | Premium apparel, white-label branding |
| 2 | Printify | Print Network | Largest catalog, vendor flexibility |
| 3 | Gelato | Print Provider | Global localized fulfillment, wall art |
| 4 | Gooten | Print Network | High-volume sellers |
| 5 | Sensaria | Print Provider | Apparel, US-based |
| 6 | SPOD (Spreadshirt) | Print Provider | Fast turnaround |
| 7 | Apliiq | Print Provider | Premium streetwear, cut-and-sew |
| 8 | CustomCat | Print Provider | Low base costs |
| 9 | Teelaunch | Print Provider | Shopify integration |
| 10 | AOP+ | Print Provider | All-over-print apparel specialist |
| 11 | T-Pop | Print Provider | EU-based, eco-focused |
| 12 | Lulu Direct | Print Provider | Self-publishing, books, magazines |
| 13 | Prodigi | Print Provider | Wall art, fine art prints |
| 14 | Fourthwall | All-in-One | Creator-focused, branded storefronts |
| 15 | Spreadconnect | Print Provider | 48-hour fulfillment |
| 16 | ShineOn | Print Provider | Jewelry POD specialist |
| 17 | Subliminator | Print Provider | Sublimation specialist (AOP) |
| 18 | Podbase | Print Provider | Tech accessories |
| 19 | PrintKK | Print Provider | Lifestyle products, rugs, lamps |
| 20 | QPMN | Print Provider | Trading cards, puzzles, TCGs |

Some of these (Printful, Gelato, Spreadconnect) operate their own print facilities; others (Printify, Gooten) are networks routing to third-party fulfillers. Track that distinction in the `Type` field — it changes how you handle quality consistency.

### Top 20 selling outlets / marketplaces (May 2026)

| # | Outlet | Type | Print integrated | Notes |
|---|---|---|---|---|
| 1 | Etsy | Marketplace | No | Pair with Printful, Printify, Gelato |
| 2 | Amazon Merch on Demand | Print Marketplace | Yes | Tier-gated, huge traffic |
| 3 | Redbubble | Print Marketplace | Yes | Standalone marketplace, set your own margin |
| 4 | TeePublic | Print Marketplace | Yes | Apparel-focused, Redbubble-owned |
| 5 | Society6 | Print Marketplace | Yes | Wall art, home decor |
| 6 | Zazzle | Print Marketplace | Yes | Personalized, occasion-driven |
| 7 | Spring (Teespring) | Print Marketplace | Yes | Creator-tied, social integrations |
| 8 | Displate | Print Marketplace | Yes | Metal posters specialist |
| 9 | Fine Art America | Print Marketplace | Yes | Fine art prints |
| 10 | Threadless | Print Marketplace | Yes | Apparel and lifestyle |
| 11 | Shopify (own store) | Own Store | No | Pair with any Print Provider |
| 12 | WooCommerce (own store) | Own Store | No | Pair with any Print Provider |
| 13 | Wix (own store) | Own Store | No | Pair with Printful, Gelato |
| 14 | Squarespace (own store) | Own Store | No | Pair with Printful, Gelato |
| 15 | eBay | Marketplace | No | Pair with Printful, Spreadshirt |
| 16 | Walmart Marketplace | Marketplace | No | Pair with major Print Providers |
| 17 | TikTok Shop | Marketplace | No | Pair with Printful, Printify |
| 18 | INPRNT | Print Marketplace | Yes | Curated art prints |
| 19 | CafePress | Print Marketplace | Yes | Established legacy marketplace |
| 20 | Big Cartel | Own Store | No | Indie-friendly, simpler than Shopify |

The `Print Integrated` field is the critical one — it tells you whether the Listing record needs a Printer link populated or not. Print-integrated outlets (Redbubble, Amazon Merch) handle their own fulfillment, so the Printer field stays empty.

---

## Common product types

Seed the Product Types table with these to start. Add more as you expand.

| Category | Product Types |
|---|---|
| Apparel | Unisex T-shirt, Women's Fitted Tee, Men's Premium Tee, Long Sleeve Tee, Tank Top, Hoodie, Pullover Sweatshirt, Zip-Up Hoodie, Crewneck Sweatshirt, Baby Onesie, Toddler T-shirt, Youth T-shirt |
| Drinkware | 11oz Mug, 15oz Mug, Travel Mug, Tumbler, Stainless Water Bottle, Wine Glass, Pint Glass |
| Wall Art | Poster, Framed Print, Canvas Print, Metal Print, Acrylic Print, Wood Print |
| Stationery | Notebook, Spiral Notebook, Hardcover Journal, Greeting Card, Postcard, Sticker Sheet, Single Sticker |
| Tech Accessories | Phone Case (Slim), Phone Case (Tough), Laptop Sleeve, Mousepad, AirPods Case |
| Bags | Tote Bag, Drawstring Bag, Backpack, Fanny Pack, Pouch |
| Home Decor | Throw Pillow, Pillow Case, Blanket, Tapestry, Shower Curtain, Bath Towel, Doormat |
| Books | Photo Book, Hardcover Book, Paperback Book, Magazine, Calendar |
| Jewelry | Necklace, Bracelet, Keychain, Pin |

---

## Reference dimensions

### Apparel sizes
`XS`, `S`, `M`, `L`, `XL`, `2XL`, `3XL`, `4XL`, `5XL`, plus youth sizes (`Y-S`, `Y-M`, `Y-L`) and toddler sizes (`2T`, `3T`, `4T`, `5T`).

### Drinkware sizes
`11oz`, `15oz`, `20oz`, `30oz`, `40oz`.

### Print sizes (US)
`5×7"`, `8×10"`, `11×14"`, `12×18"`, `16×20"`, `18×24"`, `24×36"`, `2×3" (sticker)`, `3×3"`, `4×4"`, `5×5"`, `6×6"`.

### Print sizes (metric)
`A4`, `A3`, `A2`, `A1`, `30×40cm`, `50×70cm`, `70×100cm`.

### Common apparel colors
`Black`, `White`, `Heather Gray`, `Athletic Heather`, `Navy`, `Heather Navy`, `Royal Blue`, `Red`, `Forest`, `Olive`, `Sand`, `Natural`, `Cream`, `Pink`, `Heather Mauve`, `Burgundy`, `Charcoal`, `Asphalt`, `Tan`, `Mustard`.

### Common finishes
`Matte`, `Glossy`, `Satin`, `Holographic`, `Glitter`, `Metallic Gold Foil`, `Metallic Silver Foil`, `Transparent`, `Kiss-Cut`, `Die-Cut`.

### Common materials (apparel/print)
`100% Cotton`, `50/50 Cotton-Polyester`, `Tri-Blend`, `Ringspun Cotton`, `Organic Cotton`, `Polyester`, `Bamboo`, `Premium Matte Paper`, `Glossy Photo Paper`, `Canvas`, `Aluminum`, `Acrylic`, `Birch Wood`, `Ceramic`, `Stainless Steel`, `Sterling Silver`, `Gold-Plated`.

---

## The iteration workflow

The full path from "I have a concept" to "it's listed and selling." Eight phases. Follow them in order; you'll know which phase you're in by which table you're entering data into.

### Phase 1 — Concept

1. Open the **Niches** table. Confirm a row exists for the niche you're targeting (e.g., `NCH-002 Sailing — Cruising`). If not, create one and link it to its parent if the niche has a parent.
2. Open **Design Groups**. Decide whether this design belongs in an existing series or is the start of a new one. Create a `GRP-` row if new.
3. Open **Designs**. Create a new `DES-` row.
   - Set Status to `Concept`.
   - Link to the Niche and Design Group.
   - Fill `Concept`, `Mood / Tone`, `Color Palette`, `Composition Notes`.
   - Attach reference images to `Style References`.
   - Add `Tags` (subject, style, mood, audience).
4. Save. The Design exists. No pixels yet.

### Phase 2 — Recipe

For each Image Generator you plan to try on this design:

1. Open **Generation Attempts**. Create a new `ATT-` row.
2. Link it to the Design and to the Image Generator.
3. Fill `Model Version` (e.g., `Midjourney v7`, `FLUX.2`).
4. Write the `Prompt Text` in that generator's preferred phrasing. Same design, different generators, different prompt syntax — that's expected.
5. Set `Aspect Ratio` and `Parameters` (steps, CFG, sampler if applicable).
6. Save. Move the parent Design's status to `Generating`.

### Phase 3 — Run

When you actually press "Imagine" or hit the API:

1. Run the recipe in the actual generator's UI/API.
2. Open **Generation Runs**. Create a new `RUN-` row.
3. Link to the Recipe.
4. `Run Number` autoincrements within the recipe.
5. Capture `Run Date`, `Seed` (the actual one used), `Raw Output Count`.
6. Attach the full unedited grid to `Raw Outputs`.
7. Set `Outcome`:
   - `Keepers found` if any output is worth saving
   - `No keepers` if the whole batch is unusable (still log it!)
   - `Partial — re-run planned` if it's close but not there

If the outcome is `No keepers`, stop here. Iterate the prompt and create a new run on the same recipe (or a new recipe if the prompt is materially different).

### Phase 4 — Render

For each output worth keeping:

1. Open **Renders**. Create a new `RND-` row.
2. Link to the Run.
3. Set `Iteration Type` to `Initial`.
4. Attach the file. Fill `Resolution` and `Format`.
5. Set `Batch Position` (which slot in the grid).
6. Rate `Quality Rating` (1–5).
7. Leave `Approved for Listing` unchecked for now.

### Phase 5 — Refine (optional)

When you upscale or vary a kept render:

1. In the generator, run the upscale or variation against the original.
2. Create a **new Render row** for the derivative.
3. Set `Parent Render` to the original `RND-` row.
4. Set `Iteration Type` to `Upscale`, `Subtle Variation`, `Strong Variation`, etc.
5. Same for manual edits in Photoshop — set `Iteration Type` to `Manual Edit` and link the parent.

This is what gives you the lineage tree. You can always trace a final image back to its initial output and from there to its run, recipe, and design.

### Phase 6 — Approve

Once you've decided which renders go to market:

1. Check `Approved for Listing` on each chosen Render.
2. Move the parent Design's status to `Ready for Production`.

### Phase 7 — Listing

For each approved Render × Product Type × Outlet × Brand combination:

1. Create the listing in the actual outlet (Etsy, Redbubble, etc.).
2. Open **Listings**. Create a new `LST-` row.
3. Link to the Render, Product Type, Outlet, and Brand.
4. Link to the Printer if the outlet isn't print-integrated.
5. Fill `SKU`, `Listing URL`, `Listing Title`, `Listing Description`, `Keywords`, `Price`, `Listed Date`.
6. Set Status to `Live`.
7. Move the parent Design's status to `Listed` after the first listing goes up.

### Phase 8 — Variants

For each Listing that has multiple SKUs (most apparel and drinkware):

1. Open **Variants**. Create a `VAR-` row per SKU combination.
2. Link the Variant to the parent Listing.
3. Link only the dimensions that apply (Size, Color, Finish, Phone Model, Material).
4. Fill `Variant SKU`, `Printer Variant ID`, optional `Price Override`.
5. Attach the `Mockup Image` for that specific colorway.
6. Set Status to `Active`.

### Phase 9 — Track

When sales start coming in:

1. Either manually or via integration, log Sales rows pointing at the specific Variant.
2. Roll up to Listing → Render → Design → Group → Niche to see what's working.
3. Periodically retire underperforming listings (Status → `Removed`) and designs (Status → `Retired`).

---

## Airtable formulas cheat sheet

### ID generation
```
"DES-" & RIGHT("000000" & {Autonumber}, 6)
```

### Niche full path (single-level — extend with nested IF for deeper hierarchies)
```
IF({Parent Niche}, {Parent Niche Name} & " › " & {Name}, {Name})
```

### Variant display name
```
IF({Color}, {Color} & " / ", "") &
IF({Size}, {Size} & " / ", "") &
IF({Finish}, {Finish} & " / ", "") &
IF({Phone Model}, {Phone Model} & " / ", "") &
IF({Material}, {Material}, "")
```

### Effective price (variant overrides listing if set)
```
IF({Price Override}, {Price Override}, {Listing Price})
```

### Net profit per sale
```
{Gross Revenue} - {Outlet Fee} - {Printer Cost} - {Shipping Cost}
```

### Lineage depth on Render (single ancestor)
```
IF({Parent Render}, 1 + {Parent Render Depth}, 0)
```
(`{Parent Render Depth}` is a lookup of the parent's Lineage Depth field — Airtable handles the recursion through linked lookups.)

### Listing summary line
```
{Design Title} & " — " & {Product Type Name} & " @ " & {Outlet Name}
```

### Days since listed
```
DATETIME_DIFF(NOW(), {Listed Date}, 'days')
```

### Quality flag (highlight low-rated renders)
```
IF({Quality Rating} >= 4, "✓", IF({Quality Rating} >= 3, "—", "⚠"))
```

---

## Views and dashboards

Build these in the table views first, then promote the most-used ones to Interface Designer pages.

### In Designs
- **Pipeline (kanban)** — grouped by Status, filtered to non-retired
- **By niche** — grid grouped by Niche
- **Stuck in Refining** — filter Status=Refining AND Last Updated > 14 days ago
- **Top performers** — grid sorted by Lifetime Revenue (rollup through Listings)

### In Generation Attempts
- **Generator scoreboard** — grouped by Generator, sorted by avg Best Quality
- **Active recipes** — Status=Active
- **Most-iterated** — sorted by Times Run desc

### In Generation Runs
- **No-keeper runs** — Outcome=No keepers, grouped by Generator (which generators waste your time)
- **Recent runs** — sorted by Run Date desc, last 30 days

### In Renders
- **Approved, not listed** — Approved for Listing=true AND no linked Listings
- **By design** — grouped by Design, sorted by Quality Rating desc
- **Lineage tree** — sorted by Parent Render to see derivatives clustered

### In Listings
- **Live by outlet** — grouped by Outlet, filtered Status=Live
- **By brand** — grouped by Brand
- **Underperformers** — Days Since Listed > 90 AND Lifetime Units < 1
- **Pricing audit** — sorted by Price, look for outliers

### In Variants
- **Out of stock** — Status=Out of Stock, grouped by Listing
- **By size/color** — pivot-style group on Size, then Color

### Interface Designer pages (recommended)
1. **Design pipeline** — kanban of Designs by Status
2. **Generator scoreboard** — table of Recipes with rollups
3. **Listing performance** — table of Listings with Lifetime Revenue, Lifetime Units, Days Since Listed
4. **Niche health** — drill-down: pick a niche, see linked Designs, Listings, Sales totals
5. **New design intake** — form layout for adding a Design with required fields
6. **Run logger** — form for adding a Run with attachments

---

## Build order checklist

Follow this order. Don't try to populate everything before testing the model.

- [ ] **Phase A — Reference tables**
  - [ ] Create Niches table; populate with your real niches in hierarchy
  - [ ] Create Tags table; seed with 30–50 starter tags
  - [ ] Create Image Generators table; seed with the top 20 (or just the ones you use)
  - [ ] Create Product Types table; seed with the items you actually plan to sell
  - [ ] Create Sizes, Colors, Finishes, Phone Models, Materials tables; seed with relevant dimensions
  - [ ] Create Printers table; seed with 5–10 you'll use
  - [ ] Create Outlets table; seed with the outlets you sell on
  - [ ] Create Brands table; even if you have one brand, model it
- [ ] **Phase B — Creative tables**
  - [ ] Create Design Groups; create one starter group
  - [ ] Create Designs; enter 5–10 real designs to stress-test the art direction fields
  - [ ] Adjust Designs schema based on what felt missing
- [ ] **Phase C — Generation tables**
  - [ ] Create Generation Attempts (recipes); backfill for those 5–10 designs
  - [ ] Create Generation Runs; backfill what you can remember
  - [ ] Create Renders; link to runs, set Parent Render where lineage applies
- [ ] **Phase D — Commercial tables**
  - [ ] Create Listings; create rows for your existing live listings
  - [ ] Create Variants; populate per-SKU rows for each Listing
- [ ] **Phase E — Sales (optional now)**
  - [ ] Create Sales table when you're ready to start tracking transactions
- [ ] **Phase F — Interfaces**
  - [ ] Build Design Pipeline interface
  - [ ] Build Generator Scoreboard interface
  - [ ] Build Listing Performance interface
  - [ ] Build a New Design Intake form
  - [ ] Build a Run Logger form

---

## Sources for seed data

The top-20 lists were curated from current 2026 industry roundups including Black Forest Labs (FLUX), Google (Gemini Nano Banana 2 / Imagen 4), OpenAI (GPT Image 2), Adobe (Firefly Image 5), Midjourney (v7), industry reviews from Shopify, Merch Titans, MyDesigns.io, Michael Essek, and PeaPrint, and Anthropic's own ecosystem awareness. Verify pricing, fees, and terms directly with each vendor before committing — they change frequently.

---

*End of reference document. Treat this as a living spec — update fields and tables as the workflow surfaces real gaps.*
